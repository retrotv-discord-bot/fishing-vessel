export default class MessageSendError extends Error {
    constructor() {
        super("채널에 메시지를 보낼 수 없습니다.");
        this.name = "MessageSendError";
    }
}
