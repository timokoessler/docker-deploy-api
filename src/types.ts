export enum DeployTokenAction {
    PULL_AND_RECREATE = 0,
    RECREATE = 1,
    RESTART = 2,
}

export type DeployToken = {
    containerNames: string[];
    action: DeployTokenAction;
};
