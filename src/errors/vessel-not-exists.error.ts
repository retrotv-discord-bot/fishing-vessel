export default class VesselNotExistsError extends Error {
    constructor(vesselName?: string) {
        vesselName ? super(`해당 이름을 가진 어선이 존재하지 않습니다: ${vesselName}`) : super("해당 어선이 존재하지 않습니다.");
        this.name = "VesselNotExistsError";
    }
}
