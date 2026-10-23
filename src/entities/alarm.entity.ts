import type Alarm from "./alarm";

export default class AlarmEntity implements Alarm {
    vesselName: string;
    vesselChannelId: string;
    alarmTime: string;
    use: string;

    constructor(vesselName: string, vesselChannelId: string, alarmTime: string, use: string) {
        this.vesselName = vesselName;
        this.vesselChannelId = vesselChannelId;
        this.alarmTime = alarmTime;
        this.use = use;
    }

    public disable(): void {
        this.use = "N";
    }
}
