import InvalidTimeFormat from "../errors/invalid-time-format.error";
import InvalidTimeRange from "../errors/invalid-time-range.error";
import PastTimeError from "../errors/past-time.error";

export function parseAlarmTime(alarmTime: string | null): string | null {
    if (!alarmTime) {
        return null;
    }

    // 형식이 올바른지 검증
    alarmTime = alarmTime.trim();
    alarmTime = alarmTime.replace(":", "");
    alarmTime = alarmTime.replace(" ", "");

    if (alarmTime.length !== 4 && alarmTime.length !== 3) {
        throw new InvalidTimeFormat();
    }

    if (alarmTime.length === 3) {
        alarmTime = "0" + alarmTime;
    }

    // 시간과 분이 올바른 값인지 검증
    const hh = Number.parseInt(alarmTime.substring(0, 2), 10);
    const mm = Number.parseInt(alarmTime.substring(2, 4), 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        throw new InvalidTimeRange();
    }

    // 출항 알림 시간이 지금보다 미래인지 검증
    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentAlarmTime = Number.parseInt(
        currentHours.toString().padStart(2, "0") + currentMinutes.toString().padStart(2, "0"),
        10,
    );
    const inputAlarmTime = Number.parseInt(alarmTime, 10);
    if (inputAlarmTime <= currentAlarmTime) {
        throw new PastTimeError();
    }

    alarmTime = alarmTime?.replaceAll(" ", "");
    alarmTime = alarmTime?.replaceAll(":", "");

    return alarmTime;
}

export function parseCanMidParticipation(alarmTime: string | null, canMidParticipation: boolean | null): string {
    // 중참여부 조정
    let cmp: boolean = true;
    if (alarmTime !== null && canMidParticipation !== null) {
        cmp = canMidParticipation;
    }

    return cmp ? "Y" : "N";
}
