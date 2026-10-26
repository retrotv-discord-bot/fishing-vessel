import { AutocompleteInteraction, ChatInputCommandInteraction, InteractionResponse, SlashCommandBuilder } from "discord.js";

import VesselService from "../../../../services/vessel.service";
import SlashCommand from "../../../../templates/slash-command";
import InvalidTimeFormat from "../../../../errors/invalid-time-format.error";
import InvalidTimeRange from "../../../../errors/invalid-time-range.error";
import PastTimeError from "../../../../errors/past-time.error";
import VesselAlreadyExistsError from "../../../../errors/vessel-already-exists.error";
import { privateReply } from "../../../../utils/reply";
import AlreadyEmbarkedError from "../../../../errors/already-embarked.error";
import OvercapacityError from "../../../../errors/overcapacity.error";
import VesselNotExistsError from "../../../../errors/vessel-not-exists.error";
import SinkingNotAllowError from "../../../../errors/sinking-not-allow.error";
import MessageSendError from "../../../../errors/message-send.error";
import NotEmbarkedError from "../../../../errors/not-embarked.error";

const vesselService = new VesselService();

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("어선")
        .setDescription("거기 당신! 지금 당장 어선에 오르시오!")

        // /어선 생성 선명|"선명 입력" 인원수|"인원수 입력" + 1개 선택사항
        .addSubcommand((subcommand) =>
            subcommand
                .setName("건조")
                .setDescription("어선을 생성합니다.")
                .addStringOption((option) => option.setName("선명").setDescription("어선의 이름을 정합니다.").setRequired(true))
                .addIntegerOption((option) => option.setName("인원수").setDescription("어선에 탑승할 인원수를 정합니다.").setRequired(true))
                .addStringOption((option) =>
                    option.setName("설명").setDescription("어떤 어선인지에 대한 설명을 정합니다.").setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName("출항시간")
                        .setDescription("어선의 출항시간을 정합니다. 시간은 24시간 체계로 입력하세요. (ex. 14:30, 08:30, 9:00, 2300, 930)")
                        .setRequired(false)
                        .setMinLength(3)
                        .setMaxLength(5),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("중참가능여부")
                        .setDescription(
                            "중도 참여가 가능한지 여부를 정합니다. 기본 값은 True이며, 출항시간 값이 없는 경우 여기서 지정한 값과 관계없이 항상 True로 설정됩니다.",
                        )
                        .setRequired(false),
                ),
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName("침몰")
                .setDescription("어선을 침몰시킵니다. 해당 어선의 선장만 사용할 수 있습니다!")
                .addStringOption((option) =>
                    option.setName("선명").setDescription("침몰할 어선을 선택합니다.").setRequired(true).setAutocomplete(true),
                ),
        )

        .addSubcommand((subcommand) => subcommand.setName("목록").setDescription("어선 목록을 조회합니다."))

        .addSubcommand((subcommand) =>
            subcommand
                .setName("선원목록")
                .setDescription("어선에 탑승한 선원 목록을 조회합니다.")
                .addStringOption((option) =>
                    option.setName("선명").setDescription("어선의 이름을 입력하세요.").setRequired(true).setAutocomplete(true),
                ),
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName("승선")
                .setDescription("지정한 어선에 승선합니다.")
                .addStringOption((option) =>
                    option.setName("선명").setDescription("승선할 어선을 선택합니다.").setRequired(true).setAutocomplete(true),
                ),
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName("하선")
                .setDescription("지정한 어선에서 하선합니다.")
                .addStringOption((option) =>
                    option.setName("선명").setDescription("하선할 어선을 선택합니다.").setRequired(true).setAutocomplete(true),
                ),
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName("호출")
                .setDescription("어선에 탑승한 인원들에게 알림을 보냅니다.")
                .addStringOption((option) =>
                    option.setName("선명").setDescription("호출할 어선을 선택합니다.").setRequired(true).setAutocomplete(true),
                ),
        )

        .addSubcommand((subcommand) => subcommand.setName("여담").setDescription("이 봇에 대한 여담을 알려드립니다.")),

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused(false);
        let choices: string[];

        // prettier-ignore
        switch (interaction.options.getSubcommand()) {
            case "승선":
                choices = await vesselService.getAllVessels(focusedValue, interaction.channelId);
                break;
            case "침몰":
                choices = await vesselService.getAllVessels(focusedValue, interaction.channelId, interaction.user.id, "선장");
                break;
            case "하선":
                choices = await vesselService.getAllVessels(focusedValue, interaction.channelId, interaction.user.id);
                break;
            case "선원목록":
                choices = await vesselService.getAllVessels(focusedValue, interaction.channelId, interaction.user.id);
                break;
            case "호출":
                choices = await vesselService.getAllVessels(focusedValue, interaction.channelId, interaction.user.id, "선장");
                break;
            default:
                return;
        }

        await interaction.respond(choices.map((choice) => ({ name: choice, value: choice })));
    },

    async execute(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
        switch (interaction.options.getSubcommand()) {
            case "건조":
                return callService(
                    interaction,
                    (i) => vesselService.createVessel(i),
                    [InvalidTimeFormat, InvalidTimeRange, PastTimeError, VesselAlreadyExistsError],
                    "어선 생성에 실패했습니다.",
                );
            case "침몰":
                return callService(
                    interaction,
                    (i) => vesselService.sinking(i),
                    [VesselNotExistsError, SinkingNotAllowError],
                    "어선 침몰에 실패했습니다.",
                );
            case "목록":
                return callService(
                    interaction,
                    (i) => vesselService.searchVessels(i),
                    VesselNotExistsError,
                    "어선 목록 조회에 실패했습니다.",
                );
            case "선원목록":
                return callService(
                    interaction,
                    (i) => vesselService.searchCrewsInVessel(i),
                    VesselNotExistsError,
                    "어선 승선에 실패했습니다.",
                );
            case "승선":
                return callService(
                    interaction,
                    (i) => vesselService.embark(i),
                    [VesselNotExistsError, AlreadyEmbarkedError, OvercapacityError],
                    "어선 승선에 실패했습니다.",
                );
            case "호출":
                return callService(
                    interaction,
                    (i) => vesselService.callingSailor(i),
                    MessageSendError,
                    "어선에 탑승한 선원들을 호출하지 못했습니다.",
                );
            case "하선":
                return callService(
                    interaction,
                    (i) => vesselService.disembark(i),
                    [NotEmbarkedError, MessageSendError, VesselNotExistsError],
                    "어선 하선에 실패했습니다.",
                );
            case "여담":
                return interaction.reply({
                    embeds: [
                        {
                            color: 0x0099ff,
                            title: "어선 여담",
                            description:
                                "이 봇에 사용된 그림은 사실 어선이 아닌 상선의 그림입니다. 그리고 아주 유명한 유령선이죠.\n꺄아아아악!",
                        },
                    ],
                });
            default:
                return;
        }
    },
});

type ErrorType = new (...args: never[]) => Error;
async function callService(
    interaction: ChatInputCommandInteraction,
    fn: (interaction: ChatInputCommandInteraction) => Promise<InteractionResponse<boolean>>,
    errorTypes: ErrorType | ErrorType[],
    defaultErrorMessage: string,
): Promise<void | InteractionResponse<boolean>> {
    try {
        await fn(interaction);
    } catch (error: unknown) {
        const errors = Array.isArray(errorTypes) ? errorTypes : [errorTypes];
        if (error instanceof Error && errors.some((E) => error instanceof E)) {
            return privateReply(interaction, error.message);
        } else {
            return privateReply(interaction, defaultErrorMessage);
        }
    }
}
