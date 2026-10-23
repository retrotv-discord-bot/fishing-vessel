import type Alarm from "../entities/alarm";
import { PrismaClient } from "../../generated/prisma/client";
import prisma from "../config/datasource";
import { TransactionClient } from "../../generated/prisma/internal/prismaNamespace";

export default class AlarmRepository {
    private readonly client: PrismaClient | TransactionClient;

    constructor(client?: TransactionClient) {
        this.client = client ?? prisma;
    }

    public async save(alarm: Alarm): Promise<Alarm | null> {
        let savedAlarm: Alarm | null = await this.client.alarms.findUnique({
            where: {
                vesselName_vesselChannelId: {
                    vesselName: alarm.vesselName,
                    vesselChannelId: alarm.vesselChannelId,
                },
            },
        });

        if (savedAlarm) {
            savedAlarm = await this.client.alarms.update({
                where: {
                    vesselName_vesselChannelId: {
                        vesselName: alarm.vesselName,
                        vesselChannelId: alarm.vesselChannelId,
                    },
                },
                data: {
                    use: alarm.use,
                },
            });
        } else {
            savedAlarm = await this.client.alarms.create({
                data: alarm,
            });
        }

        return savedAlarm;
    }

    public async findMany(vesselName: string, channelId: string): Promise<Alarm[]> {
        return await this.client.alarms.findMany({
            where: {
                vessel: {
                    name: vesselName,
                    channelId: channelId,
                },
            },
        });
    }

    public async findByVesselId(vesselName: string, vesselChannelId: string): Promise<Alarm | null> {
        return await this.client.alarms.findUnique({
            where: {
                vesselName_vesselChannelId: {
                    vesselName: vesselName,
                    vesselChannelId: vesselChannelId,
                },
            },
        });
    }

    public async findAlarmsTriggered(): Promise<Alarm[]> {
        // 현재 시간을 HHMM 형식으로 변환
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, "0");
        const currentMinute = String(now.getMinutes()).padStart(2, "0");
        const currentTime = currentHour + currentMinute;

        // 현재 시간과 동일하거나 이전인 알람들을 조회
        return await this.client.alarms.findMany({
            where: {
                alarmTime: {
                    lte: currentTime,
                },
                use: "Y",
            },
        });
    }

    public async deleteMany(deleteConditions: { vesselId: string; alarmTime: string }[]): Promise<void> {
        await this.client.alarms.deleteMany({
            where: {
                OR: deleteConditions.map((condition) => ({
                    vesselId: condition.vesselId,
                    alarmTime: condition.alarmTime,
                })),
            },
        });
    }
}
