export default class SinkingNotAllowError extends Error {
    constructor(message?: string) {
        super(message ?? "어선 침몰이 거부되었습니다.");
        this.name = "SinkingNotAllowError";
    }
}
