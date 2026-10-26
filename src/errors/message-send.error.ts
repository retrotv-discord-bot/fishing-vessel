export default class MessageSendError extends Error {
    constructor(message?: string) {
        super(message ?? "채널에 메시지를 보낼 수 없습니다.");
        this.name = "MessageSendError";
    }
}
