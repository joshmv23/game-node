import type { AxiosInstance } from "axios";
import axios from "axios";
import GameWorker from "./worker";
import { ExecutableGameFunctionResponseJSON } from "./function";

export interface Map {
  id: string;
}

export interface GameAgent {
  id: string;
  name: string;
  goal: string;
  description: string;
}

export enum ActionType {
  CallFunction = "call_function",
  ContinueFunction = "continue_function",
  Wait = "wait",
  TryToTalk = "try_to_talk",
  Conversation = "conversation",
  GoTo = "go_to",
  Unknown = "unknown",
}

export interface ActionArgs {
  location_id: string;
  task_id: string;
  fn_id: string;
  args: Record<string, any>;
  fn_name: string;
  thought: string;
}

export interface GameAction {
  action_type: ActionType;
  action_args: ActionArgs;
  agent_state?: Record<string, any>;
}

class GameClient {
  public client: AxiosInstance | null = null;
  private runnerUrl = "https://game.virtuals.io";

  constructor(private apiKey: string) {}

  async init() {
    const accessToken = await this.getAccessToken();

    this.client = axios.create({
      baseURL: this.runnerUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async getAccessToken() {
    const result = await axios.post<{ data: { accessToken: string } }>(
      "https://api.virtuals.io/api/accesses/tokens",
      {},
      {
        headers: {
          "x-api-key": this.apiKey,
        },
      }
    );

    return result.data.data.accessToken;
  }

  private async post<T>(url: string, data: any) {
    await this.init();

    if (!this.client) {
      throw new Error("Client is not initialized");
    }

    const result = await this.client.post<T>("/prompts", {
      data: {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        route: url,
        data,
      },
    });

    return result.data;
  }

  async createMap(workers: GameWorker[]) {
    const result = await this.post<{ data: Map }>("/v2/maps", {
      locations: workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        description: worker.description,
      })),
    });

    return result.data;
  }

  async createAgent(name: string, goal: string, description: string) {
    const result = await this.post<{ data: GameAgent }>("/v2/agents", {
      name,
      goal,
      description,
    });

    return result.data;
  }

  async getAction(
    agentId: string,
    mapId: string,
    worker: GameWorker,
    gameActionResult: ExecutableGameFunctionResponseJSON | null,
    environment: Record<string, any>,
    agentState: Record<string, any>
  ) {
    const payload: { [key in string]: any } = {
      location: worker.id,
      map_id: mapId,
      environment: environment,
      functions: worker.functions.map((fn) => fn.toJSON()),
      agent_state: agentState,
      version: "v2",
    };

    if (gameActionResult) {
      payload.current_action = gameActionResult;
    }

    const result = await this.post<{ data: GameAction }>(
      `/v2/agents/${agentId}/actions`,
      payload
    );

    return result.data;
  }

  async setTask(agentId: string, task: string) {
    const result = await this.post<{ data: { submission_id: string } }>(
      `/v2/agents/${agentId}/tasks`,
      {
        task: task,
      }
    );

    return result.data.submission_id;
  }

  async getTaskAction(
    agentId: string,
    submissionId: string,
    worker: GameWorker,
    gameActionResult: ExecutableGameFunctionResponseJSON | null,
    environment: Record<string, any>
  ) {
    const payload: Record<string, any> = {
      environment: environment,
      functions: worker.functions.map((fn) => fn.toJSON()),
    };

    if (gameActionResult) {
      payload.action_result = gameActionResult;
    }

    const result = await this.post<{ data: GameAction }>(
      `/v2/agents/${agentId}/tasks/${submissionId}/next`,
      payload
    );

    return result.data;
  }
}

export default GameClient;
