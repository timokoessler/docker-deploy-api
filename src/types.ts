/**
 * Action to perform when deploying a container.
 */
export enum DeployTokenAction {
    PULL_AND_RECREATE = 0,
    RECREATE = 1,
    RESTART = 2,
}

export type DeployToken = {
    /**
     * List of container names to deploy.
     */
    containerNames: string[];
    /**
     * Action to perform.
     */
    action: DeployTokenAction;
    /**
     * Whether to remove the old image after pulling the new one.
     */
    cleanup: boolean;
};
