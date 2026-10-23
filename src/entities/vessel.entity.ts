import type Vessel from "./vessel";

export default class VesselEntity implements Vessel {
    name: string;
    channelId: string;
    capacity: number;
    description: string;
    canMidParticipation: string;
    createdAt?: Date;

    constructor(
        name: string,
        channelId: string,
        capacity: number,
        description: string,
        canMidParticipation: string,
        createdAt?: Date,
    ) {
        this.name = name;
        this.channelId = channelId;
        this.capacity = capacity;
        this.description = description;
        this.canMidParticipation = canMidParticipation;
        this.createdAt = createdAt ?? new Date();
    }
}
