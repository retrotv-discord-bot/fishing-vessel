export default class PastTimeError extends Error {
    constructor(message?: string) {
        super(message ?? "출항시간은 현재 시간보다 미래로 설정해야 합니다.");
        this.name = "PastTimeError";
    }
}
