import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionResponse,
    MessageComponentInteraction,
    MessageFlags,
    RepliableInteraction,
} from "discord.js";

import { PrismaClient } from "../../generated/prisma/client";
import prisma from "../config/datasource";
import { logger } from "../config/logger";
import VesselAlreadyExistsError from "../errors/vessel-already-exists.error";
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
import { validateDate } from "../utils/time";
import { privateReply } from "../utils/reply";
import Crew from "../entities/crew";

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
        const channelName = getChannelNameByChatInputCommandInteraction(interaction);
        const channelId = interaction.channelId;
        let alarmTime = interaction.options.getString("출항시간");
        let canMidParticipation: boolean | string | null = interaction.options.getBoolean("중참가능여부");

        if (alarmTime !== null) {
            // 출항 시간에 대한 유효성 검증
            const [valid, message] = validateDate(alarmTime);

            if (!valid) {
                return privateReply(
                    interaction,
                    message ?? "출항 시간이 유효하지 않습니다. HH:MM 형식으로 입력해주세요.",
                );
            }

            alarmTime = alarmTime?.replaceAll(" ", "");
            alarmTime = alarmTime?.replaceAll(":", "");
        }

        // 중참여부 조정
        let cmp: boolean = true;
        if (alarmTime !== null && canMidParticipation !== null) {
            cmp = canMidParticipation;
        }

        canMidParticipation = cmp ? "Y" : "N";

        const vesselName = interaction.options.getString("선명")!;
        const vesselCapacity = interaction.options.getInteger("인원수")!;
        const vesselDescription = interaction.options.getString("설명") ?? this.DEFAULT_DESCRIPTION;
        const newVessel: Vessel = new VesselEntity(
            vesselName,
            channelId,
            vesselCapacity,
            vesselDescription,
            canMidParticipation,
        );

        logger.debug("채널 명: " + channelName);
        logger.debug("어선 명: " + vesselName);

        const captain = new CrewEntity(interaction.user.id);

        let alarm: AlarmEntity | null = null;
        if (alarmTime !== null) {
            alarm = new AlarmEntity(newVessel.name, newVessel.channelId, alarmTime, "Y");
        }

        let savedVessel;
        try {
            // 트랜잭션
            savedVessel = await this.client.$transaction(async (tx: TransactionClient) => {
                const txAlarmRepository = new AlarmRepository(tx);
                const txCrewRepository = new CrewRepository(tx);
                const txVesselRepository = new VesselRepository(tx);
                const txVesselCrewRepository = new VesselCrewRepository(tx);

                const v = await txVesselRepository.create(newVessel);
                await txCrewRepository.save(captain);

                // 3. VesselCrew 관계 저장 (선장으로 등록)
                await txVesselCrewRepository.save(new VesselCrewEntity(v.name, v.channelId, captain.id, "선장"));

                // 4. 알람 저장 (선택적)
                if (alarm !== null) {
                    await txAlarmRepository.save(alarm);
                }

                return v;
            });

            logger.info(`${channelName}(${channelId})에서 '${vesselName}' 어선 생성됨`);
        } catch (err: unknown) {
            if (err instanceof VesselAlreadyExistsError) {
                return privateReply(interaction, err.message);
            }

            if (err instanceof Error) {
                logger.error("Error: " + err.message);
            }

            return privateReply(interaction, "어선 생성에 실패했습니다.");
        }

        const vesselEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(savedVessel.name)
            .setDescription(savedVessel.description)
            .addFields(
                { name: "인원수", value: `총 ${savedVessel.capacity}명` },
                {
                    name: "출항시간",
                    value: alarmTime ? `${alarmTime.substring(0, 2)}:${alarmTime.substring(2, 4)}` : "설정되지 않음",
                },
                {
                    name: "중도참여 가능여부",
                    value: savedVessel.canMidParticipation === "Y" ? "가능" : "불가능",
                },
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
    public async embark(
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
    ): Promise<InteractionResponse<boolean>> {
        const crewId = interaction.user.id;
        const crewName = interaction.user.username;
        const crewGlobalName = interaction.user?.displayName ?? interaction.user?.globalName ?? crewName;
        const channelId = interaction.channelId;
        let vesselName;
        if (interaction.isChatInputCommand()) {
            vesselName = interaction.options.getString("선명");
        } else if (interaction.isMessageComponent()) {
            vesselName = interaction.customId.replace("embark_", "");
        }

        if (!vesselName) {
            return privateReply(interaction as RepliableInteraction, "해당하는 어선명을 찾을 수 없습니다.");
        }

        // 어선 조회
        const vessel = await this.vesselRepository.findByNameAndChannelId(vesselName, channelId);
        if (vessel === null) {
            return privateReply(interaction as RepliableInteraction, "해당 어선이 존재하지 않습니다.");
        }

        // 어선 탑승여부 확인
        const isExists = await this.crewRepository.isExistsOnVessel(crewId, vessel.name, vessel.channelId);
        if (isExists) {
            return privateReply(interaction as RepliableInteraction, "이미 해당 어선에 탑승하고 있습니다.");
        }

        const crews = await this.crewRepository.findCrewsOnVesselByVesselId(vessel.name, vessel.channelId);
        if (crews.length >= vessel.capacity) {
            return privateReply(interaction as RepliableInteraction, "어선의 정원이 초과되었습니다.");
        }

        if (vessel.canMidParticipation === "N") {
            const alarmTime = await this.alarmsRepository.findByVesselId(vessel.name, vessel.channelId);
            if (alarmTime !== null) {
                const now = new Date();
                const nowHHMM = now.getHours() * 100 + now.getMinutes();

                if (nowHHMM >= Number.parseInt(alarmTime.alarmTime)) {
                    return privateReply(
                        interaction as RepliableInteraction,
                        "어선의 출항시간이 지나서 승선할 수 없습니다!",
                    );
                }
            }
        }

        try {
            logger.debug("===== 어선 승선 시작 =====");
            logger.debug(`유저 ID: ${crewId}`);
            logger.debug(`유저 이름: ${crewName}`);
            logger.debug(`유저 글로벌 이름: ${crewGlobalName}`);
            logger.debug(`어선 명: ${vessel.name}`);
            logger.debug("유저 역할: 선원");

            const newCrew: Crew = {
                id: crewId,
            };

            await this.client.$transaction(async (tx: TransactionClient) => {
                const txCrewRepository = new CrewRepository(tx);
                await txCrewRepository.embarkCrew(newCrew, vessel.name, vessel.channelId);
            });

            logger.debug("===== 어선 승선 완료 =====");
        } catch (err) {
            if (err instanceof Error) {
                logger.error("Error: " + err.message);
            }

            return privateReply(interaction as RepliableInteraction, "어선 승선에 실패했습니다.");
        } finally {
            await this.client.$disconnect();
        }

        const vesselEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(vesselName)
            .setFields({ name: "승선한 선원", value: `${crewGlobalName}` })
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

        const crew = await this.crewRepository.findCrewOnVesselById(vesselName, channelId, crewId);
        if (crew === null) {
            return privateReply(interaction, "해당 어선에 탑승하고 있지 않습니다.");
        }

        let isCaptain = false;
        try {
            await this.client.$transaction(async (tx: TransactionClient) => {
                const txAlarmRepository = new AlarmRepository(tx);
                const txCrewRepository = new CrewRepository(tx);
                const txVesselRepository = new VesselRepository(tx);
                const txVesselCrewRepository = new VesselCrewRepository(tx);

                const vessel = await txVesselRepository.findByNameAndChannelId(vesselName, channelId);
                if (vessel === null) {
                    return privateReply(interaction, "해당 어선이 존재하지 않습니다.");
                }

                // 어선 하선
                await txVesselCrewRepository.delete(vessel.name, vessel.channelId, crew.id);

                logger.debug(`crew.id: ${crew.id}`);
                logger.debug(`crew.vessels[0] crewId: ${crew.vessels[0]?.crewId}`);
                logger.debug(`crew.vessels[0] vesselName: ${crew.vessels[0]?.vesselName}`);
                logger.debug(`crew.vessels[0] position: ${crew.vessels[0]?.position}`);

                if (crew.vessels[0]?.position === "선장") {
                    logger.debug("현재 유저의 역할이 선장입니다. 어선도 같이 침몰합니다.");

                    isCaptain = true;

                    // 모든 선원 삭제
                    const allCrews = await txCrewRepository.findMany(vesselName, channelId);
                    if (allCrews.length > 0) {
                        await txVesselCrewRepository.deleteMany(allCrews);
                    }

                    logger.debug("모든 유저를 삭제했습니다.");

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
                    }

                    logger.debug("모든 알람을 삭제했습니다.");

                    // 어선 삭제
                    await txVesselRepository.deleteMany(vesselName, channelId);

                    logger.debug("어선을 삭제했습니다.");
                }
            });
        } catch (err) {
            if (err instanceof Error) {
                logger.error("Error: " + err.message);
            }

            return privateReply(interaction, "어선 하선에 실패했습니다.");
        } finally {
            await this.client.$disconnect();
        }

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
                return privateReply(interaction, "채널에 메시지를 보낼 수 없습니다.");
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
    public async getAllVessels(
        vesselsName: string,
        channelId: string,
        crewId?: string,
        position?: string,
    ): Promise<string[]> {
        return await this.vesselRepository.findVesselsName(vesselsName, channelId, crewId, position);
    }
}
