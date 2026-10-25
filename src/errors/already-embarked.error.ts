export default class AlreadyEmbarkedError extends Error {
    constructor(vesselName?: string) {
        vesselName ? super(`이미 해당 어선에 승선한 상태입니다: ${vesselName}`) : super("이미 해당 어선에 승선한 상태입니다.");
        this.name = "AlreadyEmbarkedError";
    }
}
