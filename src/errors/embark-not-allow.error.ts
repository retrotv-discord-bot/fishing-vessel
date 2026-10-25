export default class EmbarkNotAllowError extends Error {
    constructor(message?: string) {
        super(message ?? "승선이 거부되었습니다.");
        this.name = "EmbarkNotAllowError";
    }
}
