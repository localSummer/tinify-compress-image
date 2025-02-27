import * as vscode from 'vscode';
import path from 'path';
import tinify from 'tinify';

const config = vscode.workspace.getConfiguration('tinify');

tinify.key = config.get<string>('apiKey')!;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'tinify.compressImages',
      (uri: vscode.Uri, selectedUris: vscode.Uri[] = []) =>
        compressFromFileOrFolder(uri, selectedUris, context)
    )
  );
}


async function compressFromFileOrFolder(
  uri: vscode.Uri,
  selectedUris: vscode.Uri[],
  context: vscode.ExtensionContext
) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace found for the selected file or folder.');
    throw new Error('No workspace found for the selected file or folder.');
  }

  const selectedItems = selectedUris?.length > 0 ? selectedUris : [uri];
  if (selectedItems.length === 0) {
    vscode.window.showErrorMessage('No files or folders selected.');
    return;
  }

  const selectedFileOrFolders = selectedItems.map((item) => item.fsPath);
  const workspacePath = workspaceFolder.uri.fsPath;
  const absoluteFileOrFolders = selectedFileOrFolders.map((fileOrFolder) =>
    path.isAbsolute(fileOrFolder)
      ? fileOrFolder
      : path.join(workspacePath, fileOrFolder)
  );

  try {
    await compressImages(absoluteFileOrFolders, workspacePath);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error compress image: ${error.message}`);
  }
}


async function compressImages(
  absoluteFileOrFolders: string[],
  workspacePath: string
) {
  
}
  

export function deactivate() { }