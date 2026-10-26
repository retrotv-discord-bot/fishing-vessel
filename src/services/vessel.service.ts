import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionResponse,
    MessageComponentInteraction,
    MessageFlags,
} from "discord.js";

import { PrismaClient } from "../../generated/prisma/client";
import prisma from "../config/datasource";
import { logger } from "../config/logger";
import AlarmEntity from "../entities/alarm.entity";
import CrewEntity from "../entities/crew.entity";
import Vessel from "../entities/vessel";
import VesselEntity from "../entities/vessel.entity";
import VesselCrewEntity from "../entities/vesselCrew.entity";
import AlarmRepository from "../repositories/alarm.repository";
import CrewRepository from "../repositories/crew.repository";
import VesselRepository from "../repositories/vessel.repository";
import VesselCrewRepository from "../repositories/vessel-crew.repository";
import { TransactionClient } from "../../generated/prisma/internal/prismaNamespace";
import { getChannelNameByChatInputCommandInteraction } from "../utils/channel";
import Crew from "../entities/crew";
import { parseAlarmTime, parseCanMidParticipation } from "../utils/parse";
import VesselNotExistsError from "../errors/vessel-not-exists.error";
import { getVesselName } from "../utils/vessel";
import { getUserDisplayName } from "../utils/user";
import AlreadyEmbarkedError from "../errors/already-embarked.error";
import OvercapacityError from "../errors/overcapacity.error";
import EmbarkNotAllowError from "../errors/embark-not-allow.error";
import NotEmbarkedError from "../errors/not-embarked.error";
import MessageSendError from "../errors/message-send.error";

export default class VesselService {
    private readonly DEFAULT_DESCRIPTION = "설명이 없습니다.";

    private readonly client: PrismaClient;
    private readonly alarmsRepository;
    private readonly crewRepository;
    private readonly vesselRepository;

    public constructor() {
        this.client = prisma;
        this.alarmsRepository = new AlarmRepository(this.client);
        this.crewRepository = new CrewRepository(this.client);
        this.vesselRepository = new VesselRepository(this.client);
    }

    // 건조
    public async createVessel(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        // 어선 엔티티 생성
        const channelId = interaction.channelId;
        const channelName = getChannelNameByChatInputCommandInteraction(interaction);
        const alarmTime = parseAlarmTime(interaction.options.getString("출항시간"));
        const canMidParticipation: string = parseCanMidParticipation(alarmTime, interaction.options.getBoolean("중참가능여부"));
        const vesselName = interaction.options.getString("선명")!;
        const vesselCapacity = interaction.options.getInteger("인원수")!;
        const vesselDescription = interaction.options.getString("설명") ?? this.DEFAULT_DESCRIPTION;
        const newVessel: Vessel = new VesselEntity(vesselName, channelId, vesselCapacity, vesselDescription, canMidParticipation);

        logger.debug("채널 명: " + channelName);
        logger.debug("어선 명: " + vesselName);

        // 어선 저장 트랜잭션
        const savedVessel = await this.client.$transaction(async (tx: TransactionClient) => {
            const txAlarmRepository = new AlarmRepository(tx);
            const txCrewRepository = new CrewRepository(tx);
            const txVesselRepository = new VesselRepository(tx);
            const txVesselCrewRepository = new VesselCrewRepository(tx);

            // 1. 어선 저장
            const v = await txVesselRepository.create(newVessel);

            // 2. 선원 저장
            // 선원 엔티티 생성
            const captain = new CrewEntity(interaction.user.id);

            // 선원 임시 저장
            await txCrewRepository.save(captain);

            // VesselCrew 관계 저장 (임시 저장된 선원을 선장으로 등록)
            await txVesselCrewRepository.save(new VesselCrewEntity(v.name, v.channelId, captain.id, "선장"));

            // 3. 알람 저장 (선택적)
            if (alarmTime !== null) {
                // 알람 엔티티 생성
                const alarm = new AlarmEntity(newVessel.name, newVessel.channelId, alarmTime, "Y");
                await txAlarmRepository.save(alarm);
            }

            return v;
        });

        logger.info(`${channelName}(${channelId})에서 '${vesselName}' 어선 생성됨`);

        const vesselEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(savedVessel.name)
            .setDescription(savedVessel.description)
            .addFields(
                { name: "인원수", value: `총 ${savedVessel.capacity}명` },
                { name: "출항시간", value: alarmTime ? `${alarmTime.substring(0, 2)}:${alarmTime.substring(2, 4)}` : "설정되지 않음" },
                { name: "중도참여 가능여부", value: savedVessel.canMidParticipation === "Y" ? "가능" : "불가능" },
            )
            .setTimestamp(new Date())
            .setFooter({ text: "어선 생성 완료!" });
        const embarkButton = new ButtonBuilder()
            .setCustomId("embark_" + savedVessel.name)
            .setLabel("탑승하기")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(embarkButton);

        return interaction.reply({ embeds: [vesselEmbed], components: [row] });
    }

    // 승선
    public async embark(interaction: ChatInputCommandInteraction | MessageComponentInteraction): Promise<InteractionResponse<boolean>> {
        const crewId = interaction.user.id;
        const crewName = await getUserDisplayName(interaction, crewId);
        const channelId = interaction.channelId;
        const vesselName = getVesselName(interaction);

        // 어선 조회
        const vessel = await this.vesselRepository.findByNameAndChannelId(vesselName, channelId);
        if (vessel === null) {
            throw new VesselNotExistsError(vesselName);
        }

        // 어선 탑승여부 확인
        const isExists = await this.crewRepository.isExistsOnVessel(crewId, vesselName, channelId);
        if (isExists) {
            throw new AlreadyEmbarkedError();
        }

        // 정원 초과여부 확인
        const crews = await this.crewRepository.findCrewsOnVesselByVesselId(vesselName, channelId);
        if (crews.length >= vessel.capacity) {
            throw new OvercapacityError();
        }

        if (vessel.canMidParticipation === "N") {
            const alarmTime = await this.alarmsRepository.findByVesselId(vessel.name, vessel.channelId);
            if (alarmTime !== null) {
                const now = new Date();
                const nowHHMM = now.getHours() * 100 + now.getMinutes();

                if (nowHHMM >= Number.parseInt(alarmTime.alarmTime)) {
                    throw new EmbarkNotAllowError("어선의 출항시간이 지나서 승선할 수 없습니다.");
                }
            }
        }

        logger.debug("===== 어선 승선 시작 =====");
        logger.debug(`유저 ID: ${crewId}`);
        logger.debug(`유저 이름: ${crewName}`);
        logger.debug(`어선 명: ${vesselName}`);
        logger.debug("유저 역할: 선원");

        const newCrew: Crew = {
            id: crewId,
        };

        await this.client.$transaction(async (tx: TransactionClient) => {
            const txCrewRepository = new CrewRepository(tx);
            await txCrewRepository.embarkCrew(newCrew, vessel.name, vessel.channelId);
        });

        logger.debug("===== 어선 승선 완료 =====");

        const vesselEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(vesselName)
            .setFields({ name: "승선한 선원", value: `${crewName}` })
            .setDescription("승선 완료!")
            .setTimestamp(new Date())
            .setFooter({ text: "어선 승선 완료!" });

        const embarkButton = new ButtonBuilder()
            .setCustomId("embark_" + vesselName)
            .setLabel("탑승하기")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(embarkButton);

        return interaction.reply({ embeds: [vesselEmbed], components: [row] });
    }

    // 하선
    public async disembark(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        const channelName = getChannelNameByChatInputCommandInteraction(interaction);
        const crewId = interaction.user.id;
        const vesselName = interaction.options.getString("선명")!;
        const channelId = interaction.channelId;

        logger.trace(`하선 명령어가 호출된 채널: ${channelName}`);

        const crew = await this.crewRepository.findCrewOnVesselById(vesselName, channelId, crewId);
        if (crew === null) {
            throw new NotEmbarkedError();
        }

        let isCaptain = false;
        await this.client.$transaction(async (tx: TransactionClient) => {
            const txAlarmRepository = new AlarmRepository(tx);
            const txCrewRepository = new CrewRepository(tx);
            const txVesselRepository = new VesselRepository(tx);
            const txVesselCrewRepository = new VesselCrewRepository(tx);

            const vessel = await txVesselRepository.findByNameAndChannelId(vesselName, channelId);
            if (vessel === null) {
                throw new VesselNotExistsError();
            }

            // 어선 하선
            await txVesselCrewRepository.delete(vesselName, channelId, crewId);

            logger.debug(`crew.id: ${crewId}`);
            logger.debug(`crew.vessels[0] crewId: ${crew.vessels[0]?.crewId}`);
            logger.debug(`crew.vessels[0] vesselName: ${crew.vessels[0]?.vesselName}`);
            logger.debug(`crew.vessels[0] position: ${crew.vessels[0]?.position}`);

            if (crew.vessels[0]?.position === "선장") {
                isCaptain = true;

                // 모든 선원 삭제
                const allCrews = await txCrewRepository.findMany(vesselName, channelId);
                if (allCrews.length > 0) {
                    await txVesselCrewRepository.deleteMany(allCrews);
                    logger.debug("해당 어선의 모든 유저를 삭제했습니다.");
                }

                // 알람 삭제
                const allAlarms = await txAlarmRepository.findMany(vesselName, channelId);
                if (allAlarms) {
                    const deleteConditions = allAlarms.map((alarm) => ({
                        vesselName: alarm.vesselName,
                        vesselChannelId: alarm.vesselChannelId,
                        alarmTime: alarm.alarmTime,
                    }));

                    // deleteMany를 사용하여 삭제
                    await txAlarmRepository.deleteMany(deleteConditions);
                    logger.debug("모든 알람을 삭제했습니다.");
                }

                // 어선 삭제
                await txVesselRepository.deleteMany(vesselName, channelId);
                logger.debug("현재 유저의 역할이 선장입니다. 어선도 같이 침몰합니다.");
            }
        });

        const vesselEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(vesselName)
            .setDescription("하선 완료!")
            .setTimestamp(new Date())
            .setFooter({ text: "어선 하선 완료!" });

        // 선장이 하선한 경우, 어선이 침몰되었다고 추가로 알림
        if (isCaptain) {
            const vesselEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(vesselName)
                .setDescription("어선이 침몰되었습니다!")
                .setTimestamp(new Date())
                .setFooter({ text: "꼬르륵!" });

            if (!interaction.channel?.isTextBased() || !("send" in interaction.channel)) {
                throw new MessageSendError();
            }

            await interaction.channel.send({ embeds: [vesselEmbed] });
        }

        return interaction.reply({ embeds: [vesselEmbed], flags: MessageFlags.Ephemeral });
    }

    // 침몰
    public async sinking(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }

    // 호출
    public async callingSailor(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }

    // 어선 조회
    public async searchVessels(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }

    // 어선에 탑승한 선원 조회
    public async searchCrewsInVessel(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }

    // 모든 어선 조회
    public async getAllVessels(vesselsName: string, channelId: string, crewId?: string, position?: string): Promise<string[]> {
        return await this.vesselRepository.findVesselsName(vesselsName, channelId, crewId, position);
    }
}
