import { logger } from "../config/logger";
import { PrismaClient } from "../../generated/prisma/client";
import prisma from "../config/datasource";

import type Vessel from "../entities/vessel.entity";
import { TransactionClient } from "../../generated/prisma/internal/prismaNamespace";

export default class VesselRepository {
    private readonly client: PrismaClient | TransactionClient;

    constructor(client?: TransactionClient) {
        this.client = client ?? prisma;
    }

    public async save(vessel: Vessel): Promise<Vessel | null> {
        let savedVessel = await this.client.vessels.findUnique({
            where: {
                vesselId: {
                    name: vessel.name,
                    channelId: vessel.channelId,
                },
            },
        });

        // 이미 존재하는 어선인 경우, 예외 발생
        if (savedVessel !== null) {
            logger.debug("이미 존재하는 어선입니다.");
            throw new Error("이미 존재하는 어선입니다.");
        }

        savedVessel = await this.client.vessels.create({
            data: vessel,
        });

        logger.info("어선이 성공적으로 저장되었습니다.");

        return savedVessel;
    }

    public async findById(vesselName: string, vesselChannelId: string): Promise<Vessel | null> {
        return await this.client.vessels.findUnique({
            where: {
                vesselId: {
                    name: vesselName,
                    channelId: vesselChannelId,
                },
            },
        });
    }

    public async findByNameAndChannelId(vesselName: string, channelId: string): Promise<Vessel | null> {
        return await this.client.vessels.findFirst({
            where: {
                name: vesselName,
                channelId: channelId,
            },
        });
    }

    public async findByChannelId(channelId: string): Promise<Vessel[]> {
        return await this.client.vessels.findMany({
            where: {
                channelId: channelId,
            },
        });
    }

    public async findSevenDaysOldVessels(): Promise<Vessel[]> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        return await this.client.vessels.findMany({
            where: {
                createdAt: {
                    lt: sevenDaysAgo,
                },
            },
        });
    }

    public async deleteVessel(vesselName: string, vesselChannelId: string): Promise<void> {
        // 어선 삭제
        await this.client.vessels.delete({
            where: {
                vesselId: {
                    name: vesselName,
                    channelId: vesselChannelId,
                },
            },
        });
    }

    public async deleteMany(vesselName: string, channelId: string): Promise<void> {
        await this.client.vessels.deleteMany({
            where: {
                name: vesselName,
                channelId: channelId,
            },
        });
    }

    public async deleteAll(vessels: Vessel[]): Promise<void> {
        if (vessels.length === 0) {
            return;
        }

        // 복합키(name, channelId)는 in 조건을 쓸 수 없으므로 OR 조건으로 묶어서 삭제
        await this.client.vessels.deleteMany({
            where: {
                OR: vessels.map((v) => ({
                    name: v.name,
                    channelId: v.channelId,
                })),
            },
        });
    }

    public async isExists(vesselName: string, channelId: string): Promise<boolean> {
        return (
            (await this.client.vessels.findFirst({
                where: {
                    name: vesselName,
                    channelId: channelId,
                },
            })) !== null
        );
    }

    public async findVesselsName(
        vesselsName: string,
        channelId: string,
        crewId?: string,
        position?: string,
    ): Promise<string[]> {
        /*
         * select
         *  from CREW C
         * inner join SHIP_CREW SC on C.USER_ID = SC.CREW_ID
         * inner join SHIP S on SC.SHIP_ID = S.SHIP_ID
         * where S.NAME like '%' || :shipsName || '%'
         *   and S.CHANNEL_ID = :channelId
         *   and C.USER_ID    = :crewId       -- optional
         *   and SC.POSITION  = :position     -- optional
         */
        const results = await this.client.crews.findMany({
            where: {
                vessels: {
                    some: {
                        vessel: {
                            name: {
                                contains: vesselsName,
                            },
                            channelId: channelId,
                        },

                        // position 컬럼을 optional로 필터링
                        ...(position ? { position: position } : {}),
                    },
                },
                ...(crewId ? { id: crewId } : {}),
            },
            include: {
                vessels: {
                    include: {
                        vessel: true,
                    },
                },
            },
        });

        const uniqueVesselNames: string[] = [];
        results.forEach((crew) => {
            crew.vessels.forEach((crewVessel) => {
                if (crewVessel.vessel.name && !uniqueVesselNames.includes(crewVessel.vessel.name)) {
                    uniqueVesselNames.push(crewVessel.vessel.name);
                }
            });
        });

        return uniqueVesselNames;
    }
}
