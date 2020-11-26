export enum DisplayType {
    Texture,
    Mesh,
}

export class SlateState {
    displayType: DisplayType;
    showColorWheel: boolean;

    constructor() {
        this.displayType = DisplayType.Texture;
        this.showColorWheel = false;
    }
}
