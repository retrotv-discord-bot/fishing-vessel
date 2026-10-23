import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionResponse,
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
import VesselCrewRepository from "../repositories/vesselCrew.repository";
import { TransactionClient } from "../../generated/prisma/internal/prismaNamespace";
import { getChannelName } from "../utils/channel";
import { validateDate } from "../utils/time";
import { privateReply } from "../utils/reply";

export default class UserService {
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
        const channelName = getChannelName(interaction);
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

        // 동일한 채널에 같은 이름의 어선이 존재하는지 확인
        if (await this.vesselRepository.isExists(newVessel.name, channelId)) {
            return privateReply(interaction, "이미 존재하는 어선입니다.");
        }

        const captain = new CrewEntity(interaction.user.id);

        let alarm: AlarmEntity | null = null;
        if (alarmTime !== null) {
            alarm = new AlarmEntity(newVessel.name, newVessel.channelId, alarmTime, "Y");
        }

        let savedVessel;
        try {
            // 트랜잭션
            savedVessel = await this.client.$transaction(async (tx) => {
                const txAlarmRepository = new AlarmRepository(tx as TransactionClient);
                const txCrewRepository = new CrewRepository(tx as TransactionClient);
                const txVesselRepository = new VesselRepository(tx as TransactionClient);
                const txVesselCrewRepository = new VesselCrewRepository(tx as TransactionClient);

                const v = await txVesselRepository.save(newVessel);
                await txCrewRepository.save(captain);

                if (v === null) {
                    throw new Error("어선 생성에 실패했습니다.");
                }

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
    public async embark(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }

    // 하선
    public async disembark(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
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
    public async getAllVessels(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
        throw Error();
    }
}
