export default class VesselAlreadyExistsError extends Error {
    constructor(vesselName: string) {
        super(`이미 존재하는 어선입니다: ${vesselName}`);
        this.name = "VesselAlreadyExistsError";
    }
}
