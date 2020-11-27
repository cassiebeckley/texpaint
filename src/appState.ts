export enum DisplayType {
    Texture,
    Mesh,
}

export class AppState {
    displayType: DisplayType;
    showColorWheel: boolean;

    constructor() {
        this.displayType = DisplayType.Texture;
        this.showColorWheel = false;
    }
}
