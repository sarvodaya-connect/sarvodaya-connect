import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Principal } from '../auth/principal.js';
import {
  assertCanEditSociety,
  canViewSociety,
} from '../societies/society-access.policy.js';
@Injectable()
export class NicVaultService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private key() {
    const value = this.config.get<string>('NIC_ENCRYPTION_KEY') ?? '';
    if (!/^[a-fA-F0-9]{64}$/.test(value))
      throw new ServiceUnavailableException('NIC encryption is not configured');
    return Buffer.from(value, 'hex');
  }
  async set(
    societyId: string,
    memberId: string,
    nic: string,
    principal: Principal,
  ) {
    if (!/^(?:[0-9]{9}[vVxX]|[0-9]{12})$/.test(nic))
      throw new BadRequestException('Enter a valid NIC');
    const society = await this.db.society.findUnique({
      where: { id: societyId },
    });
    if (!society || !canViewSociety(principal, society))
      throw new NotFoundException('Society not found');
    assertCanEditSociety(principal, society);
    const member = await this.db.societyCouncilMember.findFirst({
      where: { id: memberId, societyId },
    });
    if (!member) throw new NotFoundException('Member not found');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(`${societyId}:${memberId}`));
    const encrypted = Buffer.concat([
      cipher.update(nic.toUpperCase(), 'utf8'),
      cipher.final(),
    ]);
    const nicCiphertext = [iv, cipher.getAuthTag(), encrypted]
      .map((b) => b.toString('base64'))
      .join('.');
    await this.db.$transaction(async (tx) => {
      await tx.societyCouncilMember.update({
        where: { id: memberId },
        data: { nicCiphertext, nicLastFour: nic.slice(-4).toUpperCase() },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'MEMBER_NIC_UPDATED',
          targetId: memberId,
          societyId,
          districtId: society.districtId,
        },
      });
    });
    return { masked: `••••${nic.slice(-4).toUpperCase()}` };
  }
  async reveal(societyId: string, memberId: string, principal: Principal) {
    const society = await this.db.society.findUnique({
      where: { id: societyId },
    });
    if (!society || !canViewSociety(principal, society))
      throw new NotFoundException('Society not found');
    const member = await this.db.societyCouncilMember.findFirst({
      where: { id: memberId, societyId },
    });
    if (!member?.nicCiphertext) throw new NotFoundException('NIC not recorded');
    const [iv, tag, ciphertext] = member.nicCiphertext
      .split('.')
      .map((s) => Buffer.from(s, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(`${societyId}:${memberId}`));
    const nic = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    await this.db.platformAuditEvent.create({
      data: {
        actorId: principal.id,
        action: 'MEMBER_NIC_REVEALED',
        targetId: memberId,
        societyId,
        districtId: society.districtId,
      },
    });
    return { nic, hideAfterSeconds: 30 };
  }
}
