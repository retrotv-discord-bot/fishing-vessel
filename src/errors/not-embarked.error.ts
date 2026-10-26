export default class NotEmbarkedError extends Error {
    constructor(vesselName?: string) {
        vesselName ? super(`해당 어선에 탑승하고 있지 않습니다: ${vesselName}`) : super("해당 어선에 탑승하고 있지 않습니다.");
        this.name = "NotEmbarkedError";
    }
}
