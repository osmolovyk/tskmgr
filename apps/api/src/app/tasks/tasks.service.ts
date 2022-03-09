import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { Run, RunDocument } from '../runs/schemas/run.schema';
import { RunsService } from '../runs/runs.service';
import { PullRequest } from '../pull-requests/schemas/pull-request.schema';
import { RunStatus, CompleteTaskDto, CreateTaskDto, CreateTasksDto, DateUtil, StartTaskResponseDto, TaskStatus } from '@tskmgr/common';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Run.name) private readonly runModel: Model<RunDocument>,
    private readonly runsService: RunsService
  ) {}

  /**
   * Create new tasks in bulk
   * @param runId
   * @param createTasksDto
   */
  async createTasks(runId: string, createTasksDto: CreateTasksDto): Promise<Task[]> {
    const run = await this.runModel.findById(runId).populate('pullRequest').exec();
    if (!run) throw new Error(`Run id: ${runId} can't be found.`);

    if (run.status === RunStatus.Closed || run.endedAt) {
      throw new Error(`Run with ${run.status} status can't accept new tasks`);
    }

    const tasks: Partial<Task>[] = [];
    for (const createTaskDto of createTasksDto.tasks) {
      const avgDuration = await this.getAvgDuration(createTaskDto);
      const runnerId = await this.getPreviousRunnerId(run.pullRequest, createTaskDto);
      const task = {
        run: run._id,
        pullRequest: run.pullRequest,
        avgDuration: avgDuration,
        runnerId: runnerId,
        name: createTaskDto.name,
        type: createTaskDto.type,
        command: createTaskDto.command,
        arguments: createTaskDto.arguments,
        options: createTaskDto.options,
      };
      tasks.push(task);
    }

    if (run.status === RunStatus.Created) {
      run.status = RunStatus.Started;
      await run.save();
    }

    return this.taskModel.insertMany(tasks);
  }

  async findByRunId(runId: string): Promise<Task[]> {
    return this.taskModel
      .find({ run: { _id: runId } })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * Get and start one pending task
   * @param runId
   * @param runnerId
   * @param hostname
   */
  async findOnePendingTask(runId: string, runnerId: string, runnerHost: string): Promise<StartTaskResponseDto> {
    const run = await this.runModel.findById(runId).exec();
    if (!run) throw new Error(`Run id: ${runId} can't be found.`);

    if (run.endedAt) {
      return { continue: false, task: null };
    }

    const startedTask =
      (await this.getPendingTaskP1(runId, runnerId, runnerHost)) || (await this.getPendingTaskP2(runId, runnerId, runnerHost));

    if (!startedTask) {
      const canTakeNewTask = !(run.status === RunStatus.Closed);
      return { continue: canTakeNewTask, task: null };
    }

    return { continue: true, task: startedTask };
  }

  /**
   * Complete existing task
   * @param taskId
   * @param cached
   */
  async complete(taskId: string, completeTaskDto: CompleteTaskDto): Promise<Task> {
    const { cached } = completeTaskDto;
    const task = await this.taskModel.findOne({ _id: taskId }).populate('run').exec();
    if (!task) throw new Error(`Task id: ${taskId} can't be found.`);

    if (!task.startedAt || task.endedAt) {
      throw new NotImplementedException(`Task with ${task.status} status can't change to ${TaskStatus.Completed}`);
    }

    const endedAt = new Date();
    task.endedAt = endedAt;
    task.status = TaskStatus.Completed;
    task.duration = DateUtil.getDuration(task.startedAt, endedAt);
    task.cached = cached;
    await task.save();

    if (task.run.status === RunStatus.Closed) {
      if (await this.runsService.hasAllTasksCompleted(task.run)) {
        await task.run.complete().save();
      }
    }

    return task;
  }

  async fail(taskId: string): Promise<Task> {
    const task = await this.taskModel.findOne({ _id: taskId }).populate('run').exec();
    if (!task) throw new Error(`Task id: ${taskId} can't be found.`);

    if (!task.startedAt || task.endedAt) {
      throw new NotImplementedException(`Task with ${task.status} status can't change to ${TaskStatus.Failed}`);
    }

    const endedAt = new Date();
    task.endedAt = endedAt;
    task.status = TaskStatus.Failed;
    task.duration = DateUtil.getDuration(task.startedAt, endedAt);

    await task.run.abort().save();
    return task.save();
  }

  private async getPendingTaskP1(runId: string, runnerId: string, runnerHost: string): Promise<Task> {
    return this.taskModel
      .findOneAndUpdate(
        {
          run: { _id: runId },
          status: TaskStatus.Pending,
          $or: [{ runnerId: runnerId }, { runnerId: { $exists: false } }],
        },
        { $set: { startedAt: new Date(), status: TaskStatus.Started, runnerId: runnerId, runnerHost: runnerHost } },
        { new: true }
      )
      .sort({ avgDuration: -1 }) // prioritize task with >> average duration first.
      .exec();
  }

  private async getPendingTaskP2(runId: string, runnerId: string, runnerHost: string): Promise<Task> {
    return this.taskModel
      .findOneAndUpdate(
        {
          run: { _id: runId },
          status: TaskStatus.Pending,
          runnerId: { $ne: runnerId },
        },
        { $set: { startedAt: new Date(), status: TaskStatus.Started, runnerId: runnerId, runnerHost: runnerHost } },
        { new: true }
      )
      .sort({ avgDuration: -1 }) // prioritize task with >> average duration first.
      .exec();
  }

  private async getAvgDuration(createTaskDto: CreateTaskDto): Promise<number> {
    const previousTasks = await this.taskModel
      .find({
        type: createTaskDto.type,
        command: createTaskDto.command,
        arguments: createTaskDto.arguments || [],
        options: createTaskDto.options,
        status: TaskStatus.Completed,
        cached: { $ne: true }, // do not account cached tasks in the average
      })
      .sort({ endedAt: -1 })
      .limit(25)
      .exec();

    const sum = previousTasks.reduce((p, c) => p + c.duration, 0);
    return sum / previousTasks.length || undefined;
  }

  private async getPreviousRunnerId(pullRequest: PullRequest, createTaskDto: CreateTaskDto): Promise<string> {
    const task = await this.taskModel
      .findOne({
        pullRequest: pullRequest._id,
        runnerId: { $exists: true },
        status: TaskStatus.Completed,
        type: createTaskDto.type,
        command: createTaskDto.command,
        arguments: createTaskDto.arguments || [],
        options: createTaskDto.options,
      })
      .sort({ endedAt: -1 })
      .exec();

    return task?.runnerId;
  }
}
