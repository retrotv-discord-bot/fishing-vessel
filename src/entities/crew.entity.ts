import type Crew from "./crew";

export default class CrewEntity implements Crew {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}
