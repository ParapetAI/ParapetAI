import inquirer from 'inquirer';

export async function promptSecret(message: string): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    { type: 'password', name: 'value', message, mask: '*' }
  ]);
  return value;
}


