import { PrismaClient } from "../../generated/prisma/client";
import { TransactionClient } from "../../generated/prisma/internal/prismaNamespace";
import prisma from "../config/datasource";
import Crew from "../entities/crew";

import type VesselCrew from "../entities/vesselCrew";

export default class VesselCrewRepository {
    private readonly client: PrismaClient | TransactionClient;

    constructor(client?: TransactionClient) {
        this.client = client ?? prisma;
    }

    public async save(vesselCrew: VesselCrew): Promise<VesselCrew | null> {
        // 복합키를 사용한 findUnique
        let savedVesselCrew: VesselCrew | null = await this.client.vesselsCrews.findUnique({
            where: {
                vesselName_vesselChannelId_crewId: {
                    vesselName: vesselCrew.vesselName,
                    vesselChannelId: vesselCrew.vesselChannelId,
                    crewId: vesselCrew.crewId,
                },
            },
        });

        if (savedVesselCrew !== null) {
            throw new Error("해당 어선에 이미 탑승해 있습니다!");
        }

        savedVesselCrew = await this.client.vesselsCrews.create({
            data: vesselCrew,
        });

        return savedVesselCrew;
    }

    public async delete(vesselName: string, vesselChannelId: string, crewId?: string): Promise<void> {
        if (crewId) {
            await this.client.vesselsCrews.delete({
                where: {
                    vesselName_vesselChannelId_crewId: {
                        vesselName: vesselName,
                        vesselChannelId: vesselChannelId,
                        crewId: crewId,
                    },
                },
            });
        } else {
            await this.client.vesselsCrews.deleteMany({
                where: {
                    vesselName: vesselName,
                    vesselChannelId: vesselChannelId,
                },
            });
        }
    }

    public async deleteMany(crews: Crew[]): Promise<void> {
        await this.client.vesselsCrews.deleteMany({
            where: {
                crewId: {
                    in: crews.map((crew) => crew.id),
                },
            },
        });
    }
}
