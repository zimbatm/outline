import JSZip from "jszip";
import { parser } from "@server/editor";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { Attachment, Collection, Document } from "@server/models";
import DocumentHelper from "@server/models/helpers/DocumentHelper";
import { presentAttachment, presentCollection } from "@server/presenters";
import ZipHelper from "@server/utils/ZipHelper";
import { serializeFilename } from "@server/utils/fs";
import parseAttachmentIds from "@server/utils/parseAttachmentIds";
import { getFileByKey } from "@server/utils/s3";
import { NavigationNode } from "~/types";
import packageJson from "../../../package.json";
import ExportTask from "./ExportTask";

export default class ExportJSONTask extends ExportTask {
  public async export(collections: Collection[]) {
    const zip = new JSZip();

    // serial to avoid overloading, slow and steady
    for (const collection of collections) {
      await this.addCollectionToArchive(zip, collection);
    }

    this.addMetadataToArchive(zip);

    return ZipHelper.toTmpFile(zip);
  }

  private addMetadataToArchive(zip: JSZip) {
    const metadata = {
      backupVersion: 1,
      version: packageJson.version,
      createdAt: new Date(),
    };

    zip.file(
      `metadata.json`,
      env.ENVIRONMENT === "development"
        ? JSON.stringify(metadata, null, 2)
        : JSON.stringify(metadata)
    );
  }

  private async addCollectionToArchive(zip: JSZip, collection: Collection) {
    const output = {
      ...presentCollection(collection),
      url: undefined,
      description: parser.parse(collection.description),
      documentStructure: collection.documentStructure,
      documents: {},
      attachments: {},
    };

    async function addDocumentTree(nodes: NavigationNode[]) {
      for (const node of nodes) {
        const document = await Document.findByPk(node.id, {
          includeState: true,
        });

        if (!document) {
          continue;
        }

        const attachments = await Attachment.findAll({
          where: {
            teamId: document.teamId,
            id: parseAttachmentIds(document.text),
          },
        });

        await Promise.all(
          attachments.map(async (attachment) => {
            try {
              const img = await getFileByKey(attachment.key);

              if (img) {
                zip.file(attachment.key, img as Blob, {
                  createFolders: true,
                });
              }

              output.attachments[attachment.id] = {
                ...presentAttachment(attachment),
                key: attachment.key,
                url: undefined,
              };
            } catch (err) {
              Logger.error(
                `Failed to add attachment to archive: ${attachment.key}`,
                err
              );
            }
          })
        );

        output.documents[document.id] = {
          id: document.id,
          urlId: document.urlId,
          title: document.title,
          data: DocumentHelper.toProsemirror(document),
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          publishedAt: document.publishedAt,
          fullWidth: document.fullWidth,
          template: document.template,
          parentDocumentId: document.parentDocumentId,
        };

        if (node.children?.length > 0) {
          await addDocumentTree(node.children);
        }
      }
    }

    if (collection.documentStructure) {
      await addDocumentTree(collection.documentStructure);
    }

    zip.file(
      `${serializeFilename(collection.name)}.json`,
      env.ENVIRONMENT === "development"
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output)
    );
  }
}
