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
  for (const fileOrFolder of absoluteFileOrFolders) {
    await processFileOrFolder(fileOrFolder);
  }

  async function processFileOrFolder(fileOrFolder: string) {
    const stats = await vscode.workspace.fs.stat(vscode.Uri.file(fileOrFolder));

    if (stats.type === vscode.FileType.File) {
      await compressSingleFile(fileOrFolder);
    } else if (stats.type === vscode.FileType.Directory) {
      await processDirectory(fileOrFolder);
    }
  }

  async function compressSingleFile(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      try {
        const source = tinify.fromFile(filePath);
        const parsedPath = path.parse(filePath);
        const compressedFileName = `${parsedPath.name}-compressed${parsedPath.ext}`;
        const compressedFilePath = path.join(parsedPath.dir, compressedFileName);
        await source.toFile(compressedFilePath);
        vscode.window.showInformationMessage(
          `Image compressed successfully: ${compressedFilePath}`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error compressing image ${filePath}: ${error.message}`
        );
      }
    }
  }

  async function processDirectory(dirPath: string) {
    const files = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(dirPath)
    );
    for (const [fileName, fileType] of files) {
      const fullPath = path.join(dirPath, fileName);
      if (fileType === vscode.FileType.File) {
        await compressSingleFile(fullPath);
      } else if (fileType === vscode.FileType.Directory) {
        await processDirectory(fullPath); // 递归处理子目录
      }
    }
  }
}
  

export function deactivate() { }