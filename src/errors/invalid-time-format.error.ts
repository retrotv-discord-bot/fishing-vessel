export default class InvalidTimeFormat extends Error {
    constructor(message?: string) {
        super(
            message ??
                "출항시간은 24시간 체계의 hhmm 혹은 hh:mm 형식으로 입력해주세요.\n예시: 18:30, 06:00, 9:00, 1000, 2030, 800",
        );
        this.name = "InvalidTimeFormatError";
    }
}
