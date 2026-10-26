import { TextChannel, type Client } from "discord.js";

import { PrismaClient } from "@prisma/client/extension";
import prisma from "../config/datasource";

import { logger } from "../config/logger";
import AlarmRepository from "../repositories/alarm.repository";
import CrewRepository from "../repositories/crew.repository";
import VesselRepository from "../repositories/vessel.repository";
import { getChannelNameByClientAndId } from "../utils/channel";
import MessageSendError from "../errors/message-send.error";
import Alarm from "../entities/alarm";
import VesselNotExistsError from "../errors/vessel-not-exists.error";

export default class AlarmService {
    private readonly client: PrismaClient;
    private readonly alarmRepository: AlarmRepository;
    private readonly crewRepository: CrewRepository;
    private readonly vesselRepository: VesselRepository;

    public constructor() {
        this.client = prisma;
        this.alarmRepository = new AlarmRepository(this.client);
        this.crewRepository = new CrewRepository(this.client);
        this.vesselRepository = new VesselRepository(this.client);
    }

    public async sendAlarm(client: Client): Promise<void> {
        // 현재 시간과 동일하거나 이전인 알람들을 조회하고, 없으면 바로 리턴
        const alarms = await this.alarmRepository.findAlarmsTriggered();
        if (alarms.length === 0) {
            return;
        }

        logger.trace(`알람이 ${alarms.length}개 있습니다.`);

        const results = await Promise.allSettled(
            alarms.map(async (alarm) => {
                const vessel = await this.vesselRepository.findById(alarm.vesselName, alarm.vesselChannelId);
                if (vessel === null) {
                    throw new VesselNotExistsError(alarm.vesselName);
                }

                const vesselName = vessel.name;
                const channelId = vessel.channelId;
                const crews = await this.crewRepository.findCrewsOnVessel(vesselName, channelId);
                if (crews.length === 0) {
                    await this.alarmOff(alarm);
                    return;
                }

                const channelName = await getChannelNameByClientAndId(client, channelId);
                logger.debug(`어선 명: ${vesselName}`);
                logger.debug(`채널 명: ${channelName}`);

                const crewIds = crews.map((crew) => crew.id);

                let userMentions = `⛴️ 출항 알림: `;
                userMentions = userMentions + crewIds.map((userId) => `<@${userId}>`).join(", ");
                userMentions = userMentions + ` 선원들! 지금 당장 ${vesselName}에 탑승하시오!`;

                const channel = await client.channels.fetch(channelId);
                if (channel !== null && channel instanceof TextChannel) {
                    await channel.send(userMentions);
                } else {
                    await this.alarmOff(alarm);
                    throw new MessageSendError(`존재하지 않거나 메시지를 보낼 수 없는 유형의 채널입니다: ${channelId}`);
                }

                await this.alarmOff(alarm);
                logger.debug(`${vesselName} 어선에 알람 보냄`);
            }),
        );

        results.forEach((r, i) => {
            if (r.status === "rejected") logger.error(`${alarms[i].vesselName} 알람 실패: ${r.reason}`);
        });
    }

    private async alarmOff(alarm: Alarm) {
        return await this.alarmRepository.save({
            vesselName: alarm.vesselName,
            vesselChannelId: alarm.vesselChannelId,
            alarmTime: alarm.alarmTime,
            use: "N",
        });
    }
}
