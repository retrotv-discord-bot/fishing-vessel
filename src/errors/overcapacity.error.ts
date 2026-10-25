export default class OvercapacityError extends Error {
    constructor() {
        super("해당 어선이 수용할 수 있는 인원을 초과했습니다.");
        this.name = "OvercapacityError";
    }
}
