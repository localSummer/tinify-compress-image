import * as vscode from 'vscode';
import path from 'path';
import tinify from 'tinify';

const config = vscode.workspace.getConfiguration('tinify');

tinify.key = config.get<string>('apiKey')!;

/**
 * 激活扩展时调用的函数，用于注册命令。
 * @param context - VS Code 扩展上下文，用于管理扩展的生命周期和订阅。
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'tinify.compressImages',
      (uri: vscode.Uri, selectedUris: vscode.Uri[] = []) =>
        compressFromFileOrFolder(uri, selectedUris, context)
    )
  );
}

/**
 * 压缩指定文件或文件夹中的图片。
 * @param uri - 用户选择的文件或文件夹的 URI。
 * @param selectedUris - 用户选择的多个文件或文件夹的 URI 数组。
 * @param context - VS Code 扩展上下文，用于管理扩展的生命周期和订阅。
 */
async function compressFromFileOrFolder(
  uri: vscode.Uri,
  selectedUris: vscode.Uri[],
  context: vscode.ExtensionContext
) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(
      'No workspace found for the selected file or folder.'
    );
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

/**
 * 压缩指定路径下的图片文件或文件夹。
 * @param absoluteFileOrFolders - 需要压缩的文件或文件夹的绝对路径数组。
 * @param workspacePath - 当前工作区的根路径。
 */
async function compressImages(
  absoluteFileOrFolders: string[],
  workspacePath: string
) {
  /** 压缩后的文件是否替换源文件 */
  let replaceOriginal: boolean | null = null;

  for (const fileOrFolder of absoluteFileOrFolders) {
    await processFileOrFolder(fileOrFolder);
  }

  /**
   * 处理单个文件或文件夹，根据类型调用不同的处理函数。
   * @param fileOrFolder - 需要处理的文件或文件夹路径。
   */
  async function processFileOrFolder(fileOrFolder: string) {
    const stats = await vscode.workspace.fs.stat(vscode.Uri.file(fileOrFolder));

    if (stats.type === vscode.FileType.File) {
      await compressSingleFile(fileOrFolder, replaceOriginal);
    } else if (stats.type === vscode.FileType.Directory) {
      if (replaceOriginal === null) {
        const selection = await getCompressionOption();
        if (!selection) return;
        replaceOriginal = selection.label === 'REPLACE';
      }
      await processDirectory(fileOrFolder);
    }

    vscode.window.showInformationMessage('Image compressed successfully');
  }

  /**
   * 压缩单个图片文件。
   * @param filePath - 需要压缩的图片文件路径。
   * @param userChoice - 用户选择的压缩选项，决定是否覆盖原文件。
   */
  async function compressSingleFile(
    filePath: string,
    userChoice: boolean | null = null
  ) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      try {
        let replaceOriginal = userChoice;

        if (replaceOriginal === null) {
          const selection = await getCompressionOption();
          if (!selection) return;
          replaceOriginal = selection.label === 'REPLACE';
        }

        const source = tinify.fromFile(filePath);
        const parsedPath = path.parse(filePath);

        let targetPath: string;
        if (replaceOriginal) {
          targetPath = filePath;
        } else {
          const compressedFileName = `${parsedPath.name}-compressed${parsedPath.ext}`;
          targetPath = path.join(parsedPath.dir, compressedFileName);
        }

        await source.toFile(targetPath);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error compressing image ${filePath}: ${error.message}`
        );
      }
    }
  }

  /**
   * 处理文件夹中的所有文件，递归调用压缩函数。
   * @param dirPath - 需要处理的文件夹路径。
   */
  async function processDirectory(dirPath: string) {
    const files = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(dirPath)
    );
    for (const [fileName, fileType] of files) {
      const fullPath = path.join(dirPath, fileName);
      if (fileType === vscode.FileType.File) {
        await compressSingleFile(fullPath, replaceOriginal);
      } else if (fileType === vscode.FileType.Directory) {
        await processDirectory(fullPath);
      }
    }
  }

  /**
   * 获取用户选择的压缩选项，决定是否覆盖原文件。
   * @returns 用户选择的压缩选项。
   */
  async function getCompressionOption() {
    return await vscode.window.showQuickPick(
      [
        { label: 'REPLACE', description: '压缩后的文件将覆盖原文件' },
        {
          label: 'NEW',
          description: '将创建一个带有"-compressed"后缀的新文件',
        },
      ],
      { placeHolder: '请选择压缩后的文件保存方式' }
    );
  }
}

/**
 * 停用扩展时调用的函数，用于清理资源。
 */
export function deactivate() {}
