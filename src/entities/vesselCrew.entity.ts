import type VesselCrew from "./vesselCrew";

export default class VesselCrewEntity implements VesselCrew {
    vesselName: string;
    vesselChannelId: string;
    crewId: string;
    position: string;

    constructor(vesselName: string, vesselChannelId: string, crewId: string, position: string) {
        this.vesselName = vesselName;
        this.vesselChannelId = vesselChannelId;
        this.crewId = crewId;
        this.position = position;
    }
}
