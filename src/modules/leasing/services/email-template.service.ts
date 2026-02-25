import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class EmailTemplateService {
  /**
   * Generate email HTML from template
   */
  async generateExecutionEmail(data: {
    firstName: string;
    businessName: string;
    property: string;
    suite: string;
    docusignUri: string;
    userName: string;
    userRole: string;
  }): Promise<string> {
    const templatePath = join(__dirname, '../templates/execution-email.html');
    let template = await readFile(templatePath, 'utf8');

    // Replace all placeholders
    template = template
      .replace(/{{firstName}}/g, data.firstName)
      .replace(/{{businessName}}/g, data.businessName)
      .replace(/{{property}}/g, data.property)
      .replace(/{{suite}}/g, data.suite)
      .replace(/{{docusignUri}}/g, data.docusignUri)
      .replace(/{{userName}}/g, data.userName)
      .replace(/{{userRole}}/g, data.userRole);

    return template;
  }

  /**
   * Generate follow-up email HTML from template
   */
  async generateFollowUpEmail(data: {
    firstName: string;
    property: string;
    docusignUri: string;
    userName: string;
    userRole: string;
    daysAgo: number;
  }): Promise<string> {
    const templatePath = join(__dirname, '../templates/execution-followup-email.html');
    let template = await readFile(templatePath, 'utf8');

    // Replace all placeholders
    template = template
      .replace(/{{firstName}}/g, data.firstName)
      .replace(/{{property}}/g, data.property)
      .replace(/{{docusignUri}}/g, data.docusignUri)
      .replace(/{{userName}}/g, data.userName)
      .replace(/{{userRole}}/g, data.userRole)
      .replace(/{{daysAgo}}/g, data.daysAgo.toString());

    return template;
  }
}
