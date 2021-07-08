#!/usr/bin/env node

// Import relevant modules.
import chalk from 'chalk';
import {spawn} from 'child_process';
import chokidar from 'chokidar';
import {Command} from 'commander';
import {once} from 'events';
import ora from 'ora';
import sleep from 'sleep';

/**
 * Process and execute the specified commands.
 * @constructor
 * @param {OptionValues} options - Options containing the commands
 */
async function processAndExecute(options: OptionValues) {
  // Create a variable to control the loop breaking condition.
  let iterationError: boolean = false;
  // Iterate through the commands.
  for (const command of options.commands) {
    // Process the command.
    const cmdArray = command.split(' ');
    const cmdProgram: string = cmdArray[0];
    const cmdArgs: string[] = cmdArray.slice(1);
    // Start the display system.
    const infoSpinner = ora(`Running "${command}"`);
    infoSpinner.color = 'yellow';
    infoSpinner.spinner = 'dots';
    infoSpinner.start();
    // Execute the command.
    const childProcess = spawn(cmdProgram, cmdArgs);
    // Check if the command could be executed.
    childProcess.on('error', () => {
      infoSpinner.stop();
      console.log(chalk.red('Error executing the command "' + command + '"'));
      console.log(
        chalk.yellow('Hint: ') +
          'The command could not be executed on your terminal. ' +
          'It may be the case that the command was typed incorrectly. ' +
          'Please run if possible the command on its own on your terminal ' +
          'to further investigate the problem.'
      );
      iterationError = true;
    });
    // Evaluate the result of the execution.
    childProcess.on('exit', (exitCode: number) => {
      if (childProcess.stdout || childProcess.stderr) {
        if (exitCode == 0) {
          infoSpinner.succeed();
        } else {
          infoSpinner.fail();
          spawn(cmdProgram, cmdArgs, {stdio: 'inherit'});
          iterationError = true;
        }
      }
    });
    // Wait for the process of the current command to finish.
    try {
      await once(childProcess, 'exit');
    } catch (error) {}
    await Promise.all([childProcess]);
    // Check if the program should be allowed
    // to proceed to the next iteration.
    if (iterationError) {
      break;
    }
  }
}

/** Main function */
function run() {
  // Create a new program handler.
  const program = new Command();
  // Specify the current version.
  program.version('0.1.5');
  // Specify the configuration for the "path" flag.
  program.option('-p, --path <file|dir|glob|array>', 'Path(s) to watch', '.');
  // Specify the configuration for the "commands" flag.
  program.requiredOption('-c, --commands <cmd...>', 'Commands to run');
  // Parse the command line arguments.
  program.parse(process.argv);
  const options = program.opts();
  console.log(options);
  if (!options.path) options.path = '.';
  // Watch files and process and execute
  // each command on change.
  const waitSpinner = ora('Waiting for changes...');
  waitSpinner.color = 'green';
  waitSpinner.spinner = {
    interval: 1000,
    frames: ['●', '○'],
  };
  const watcher = chokidar.watch(options.path);
  console.clear();
  waitSpinner.start();
  watcher.on('change', () => {
    waitSpinner.stop();
    console.clear();
    const unwatchPromise = watcher.unwatch(options.path);
    const processAndExecutePromise = processAndExecute(options);
    Promise.all([unwatchPromise, processAndExecutePromise])
      .then(() => {
        waitSpinner.color = 'yellow';
        waitSpinner.start('Please wait...\n');
        sleep.sleep(4);
        watcher.add(options.path || '.');
        waitSpinner.color = 'green';
        waitSpinner.text = 'Waiting for changes...';
      })
      .catch((error) => console.error(chalk.red(error)));
  });
}

// Run the main program.
run();
