import { ApplyOptions } from '@sapphire/decorators';
import {
  ApplicationCommandRegistry,
  Command,
  CommandOptions
} from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';
import axios from 'axios';
import * as data from '../../config.json';

@ApplyOptions<CommandOptions>({
  name: 'hug',
  description: 'Replies with a random hug gif!',
  preconditions: ['isCommandDisabled']
})
export class HugCommand extends Command {
  public override chatInputRun(interaction: CommandInteraction) {
    axios
      .get(`https://api.tenor.com/v1/random?key=${data.tenorAPI}&q=hug&limit=1`)
      .then(async response => {
        return await interaction.reply({
          content: response.data.results[0].url
        });
      })
      .catch(async error => {
        console.error(error);
        return await interaction.reply(
          'Something went wrong when trying to fetch a hug gif :('
        );
      });
  }

  public override registerApplicationCommands(
    registery: ApplicationCommandRegistry
  ): void {
    registery.registerChatInputCommand({
      name: this.name,
      description: this.description
    });
  }
}
