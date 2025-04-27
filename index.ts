import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import SlashCommand from "./src/types/slash-command";
import PrefixCommand from "./src/types/prefix-command";

import { slashCommands, prefixCommands } from "./src/discord/commands";
import { events } from "./src/discord/events";
import { config } from "./config";

declare global {
    // prettier-ignore
    var client: Client & { // NOSONAR
        slashCommands: Collection<string, SlashCommand>;
        prefixCommands: Collection<string, PrefixCommand>;
    };
}

global.client = Object.assign(
    new Client({
        intents: [
            /*
             * Guilds:                      서버 관련 이벤트를 수신할 수 있는 권한
             * GuildMembers:                서버의 멤버 관련 이벤트를 수신할 수 있는 권한
             * GuildModeration:             서버의 관리(모더레이션) 관련 이벤트를 수신할 수 있는 권한
             * GuildExpressions:            서버의 이모지와 스티커 관련 이벤트를 수신할 수 있는 권한
             * GuildIntegrations:           서버의 통합 관련 이벤트를 수신할 수 있는 권한
             * GuildWebhooks:               서버의 웹훅 관련 이벤트를 수신할 수 있는 권한
             * GuildInvites:                서버의 초대 관련 이벤트를 수신할 수 있는 권한
             * GuildVoiceStates:            서버의 음성 상태 관련 이벤트를 수신할 수 있는 권한
             * GuildPresences:              서버의 멤버 상태(온라인, 오프라인 등) 관련 이벤트를 수신할 수 있는 권한
             * GuildMessages:               서버 내에서 발생하는 메시지 이벤트를 수신할 수 있는 권한
             * GuildMessageReactions:       서버 내에서 발생하는 메시지 반응 이벤트를 수신할 수 있는 권한
             * GuildMessageTyping:          다이렉트 메시지의 입력(타이핑) 이벤트를 수신할 수 있는 권한
             * DirectMessages:              다이렉트 메시지 관련 이벤트를 수신할 수 있는 권한
             * DirectMessageReactions:      다이렉트 메시지의 반응 이벤트를 수신할 수 있는 권한
             * DirectMessageTyping:         다이렉트 메시지의 입력(타이핑) 이벤트를 수신할 수 있는 권한
             * MessageContent:              메시지의 실제 내용을 읽을 수 있는 권한
             * GuildScheduledEvents:        서버의 일정 이벤트 관련 이벤트를 수신할 수 있는 권한
             * AutoModerationConfiguration: 자동 모더레이션 설정 관련 이벤트를 수신할 수 있는 권한
             * AutoModerationExecution:     자동 모더레이션 실행 관련 이벤트를 수신할 수 있는 권한
             * GuildMessagePolls:           서버 내에서 발생하는 메시지 투표 이벤트를 수신할 수 있는 권한
             * DirectMessagePolls:          다이렉트 메시지의 투표 이벤트를 수신할 수 있는 권한
             */

            /*
             * Guilds: 서버에 봇이 초대되거나 퇴장할 때, 슬래시 명령어 배포를 위해 필요
             */
            GatewayIntentBits.Guilds,

            /*
             * GuildMessages, MessageContent: Prefix 명령어를 사용하기 위해 필요
             */
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel],
    }),
    {
        slashCommands: new Collection<string, SlashCommand>(),
        prefixCommands: new Collection<string, PrefixCommand>(),
    },
);

// 슬래시 명령어 불러오기
slashCommands.forEach((command) => {
    global.client.slashCommands.set(command.data.name, command);
});

// prefix 명령어 불러오기
prefixCommands.forEach((command) => {
    global.client.prefixCommands.set(command.name, command);
});

// 이벤트 불러오기
events.forEach((event) => {
    console.log(`Loading event: ${event.name}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
});

// 봇 로그인
client.login(config.BOT_TOKEN);
