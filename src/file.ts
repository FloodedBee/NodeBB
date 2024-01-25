
import * as fs from 'fs/promises';
import * as nconf from 'nconf';
import * as path from 'path';
import * as winston from 'winston';
import * as mkdirp from 'mkdirp';
import * as mime from 'mime';
import * as graceful from 'graceful-fs';

import meta = require('./meta');
import slugify = require('./slugify');

import { promisify } from './promisify';

declare function slugify(value: string): string;

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
graceful.gracefulify(fs);

interface FileResult {
    url: string;
    path: string;
}

interface FileFunctions {
    saveFileToLocal: (filename: string, folder: string, tempPath: string) => Promise<FileResult>;
    base64ToLocal: (imageData: string, uploadPath: string) => Promise<string>;
    appendToFileName: (filename: string, string: string) => string;
    allowedExtensions: () => string[];
    exists: (path: string) => Promise<boolean>;
    delete: (path: string) => Promise<void>;
    link: (filePath: string, destPath: string, relative: boolean) => Promise<void>;
    linkDirs: (sourceDir: string, destDir: string, relative: boolean) => Promise<void>;
    typeToExtension: (type: string) => string;
}
const file: FileFunctions = {
    saveFileToLocal: async function (filename, folder, tempPath) {
        filename = filename.split('.').map(name => slugify(name)).join('.');
        const uploadPath = path.join(String(nconf.get('upload_path')), String(folder), String(filename));
        if (!uploadPath.startsWith(String(nconf.get('upload_path')))) {
            throw new Error('[[error:invalid-path]]');
        }
        winston.verbose(`Saving file ${filename} to : ${uploadPath}`);
        const dirName: string = path.dirname(uploadPath);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await mkdirp(dirName);
        await fs.copyFile(tempPath, uploadPath);
        return {
            url: `/assets/uploads/${folder ? `${folder}/` : ''}${filename}`,
            path: uploadPath,
        };
    },
    base64ToLocal: async function (imageData, uploadPath) {
        const buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
        uploadPath = path.join(String(nconf.get('upload_path')), String(uploadPath));
        await fs.writeFile(uploadPath, buffer, {
            encoding: 'base64',
        });
        return uploadPath;
    },
    appendToFileName: function (filename, string) {
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex === -1) {
            return filename + string;
        }
        return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
    }, /*
    allowedExtensions: function () {
        const allowedFileExtensions = meta.config?.allowedFileExtensions?.trim() || '';
        if (!allowedFileExtensions) {
            return [];
        }
        const extensions = allowedFileExtensions.split(',')
            .map(extension => extension.trim())
            .filter(Boolean)
            .map(extension => !extension.startsWith('.') ? `.${extension}` : extension.toLowerCase());
        if (!extensions.includes('.jpg') && extensions.includes('.jpeg')) {
            extensions.push('.jpg');
        }
        return extensions;
    }, */
    allowedExtensions: function () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const allowedFileExtensions: string = (meta.config.allowedFileExtensions as string).trim();
        /* let allowedExtensions = (meta.config.allowedFileExtensions || '').trim(); */
        if (!allowedFileExtensions) {
            return [];
        }
        let allowedExtensions = allowedFileExtensions.split(',');
        allowedExtensions = allowedExtensions.filter(Boolean).map((extension) => {
            extension = extension.trim();
            if (!extension.startsWith('.')) {
                extension = `.${extension}`;
            }
            return extension.toLowerCase();
        });
        if (allowedExtensions.includes('.jpg') && !allowedExtensions.includes('.jpeg')) {
            allowedExtensions.push('.jpeg');
        }
        return allowedExtensions;
    },
    exists: async function (filePath: string): Promise<boolean> {
        try {
            await fs.stat(filePath);
        } catch (err) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
        return true;
    },
    /*
    file.existsSync = function (filePath) {
        try {
            fs.statSync(filePath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
        return true;
    };
    */
    delete: async function (filePath) {
        if (!filePath) {
            return;
        }
        try {
            await fs.unlink(filePath);
        } catch (err) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (err.code === 'ENOENT') {
                winston.verbose(`[file] Attempted to delete non-existent file: ${filePath}`);
                return;
            }
            winston.warn(err);
        }
    },
    link: async function link(filePath, destPath, relative) {
        if (relative && process.platform !== 'win32') {
            filePath = path.relative(path.dirname(destPath), filePath);
        }
        if (process.platform === 'win32') {
            await fs.link(filePath, destPath);
        } else {
            await fs.symlink(filePath, destPath, 'file');
        }
    },
    linkDirs: async function linkDirs(sourceDir, destDir, relative) {
        if (relative && process.platform !== 'win32') {
            sourceDir = path.relative(path.dirname(destDir), sourceDir);
        }
        const type = (process.platform === 'win32') ? 'junction' : 'dir';
        await fs.symlink(sourceDir, destDir, type);
    },
    typeToExtension: function (type) {
        let extension = '';
        if (type) {
            extension = `.${mime.extension(type)}`;
        }
        return extension;
    },
    /*
    file.walk = async function (dir) {
        const subdirs = await fs.readdir(dir);
        const files = await Promise.all(subdirs.map(async (subdir) => {
            const res = path.resolve(dir, subdir);
            return (await fs.stat(res)).isDirectory() ? file.walk(res) : res;
        }));
        return files.reduce((a, f) => a.concat(f), []);
    };
    */
};
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
promisify(file);
