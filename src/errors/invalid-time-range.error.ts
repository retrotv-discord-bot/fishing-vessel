export default class InvalidTimeRange extends Error {
    constructor(message?: string) {
        super(message ?? "출항시간이 정상적인 시간의 범주가 아닙니다.");
        this.name = "InvalidTimeFormatError";
    }
}
