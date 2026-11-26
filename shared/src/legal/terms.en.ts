import type { LegalDocument } from './types.js';

/**
 * Terms of service, English (feature 022). The counterpart of `terms.es.ts`.
 *
 * **A DRAFT, NOT A LEGAL DOCUMENT** — a qualified reviewer must read it before anyone relies on it.
 *
 * Same section ids in the same order as the Spanish, and the same `updatedAt`; the structural check
 * enforces both and cannot tell whether the two say the same thing. Two rules govern what this text
 * may NOT say, both explained in the Spanish file: a reservation is a REQUEST, never a held table or
 * room, and no real payment happens today.
 */
export const termsEn: LegalDocument = {
  id: 'terms',
  language: 'en',
  title: 'Terms of service',
  updatedAt: '2026-11-25',
  sections: [
    {
      id: 'what-svtrip-is',
      heading: 'What SVTrip is',
      body: [
        'SVTrip is an app for discovering places and services in El Salvador, building travel plans and, for people who run a business, showing that business to travelers.',
        'Information about places comes from our catalog and from the businesses themselves. We do our best to keep it correct, but it can change without notice: opening hours, prices and availability may differ from what the app shows, so it is worth confirming them with the business.',
      ],
    },
    {
      id: 'your-account',
      heading: 'Your account',
      body: [
        'To use most of the app you need an account. You are responsible for what is done with it.',
        'SVTrip is intended for people aged 13 or over.',
        'The details you give us when you register must be true. You can edit them at any time from your profile.',
        'What we do with your data is explained in the privacy policy.',
      ],
    },
    {
      id: 'what-merchants-publish',
      heading: 'What businesses publish',
      body: [
        'A business manages its own profile: the description, photos, opening hours, contact details and promotions. It is responsible for what it publishes being true and for having the right to publish it, photos included.',
        'To manage a business that is already in the catalog you have to request it and wait for a person on the SVTrip team to approve it. Asking does not give you the business.',
        'We reserve the right to hide or remove content that is false, misleading, offensive or that does not belong to the person who published it. There is no automatic review today: a person on the team does it when they find out.',
        'Reviews are written by travelers. A business can reply to them, but cannot edit or delete them.',
        'A business’s visibility can depend on the state of its subscription.',
      ],
    },
    {
      id: 'merchant-membership',
      heading: 'Business membership',
      source:
        'specs/025-business-signup/spec.md (FR-006, FR-006a, FR-008, FR-009, FR-012, FR-029); specs/018-merchant-subscription-plans (states and visibility); shared/src/subscriptions.ts (default prices).',
      body: [
        'A business can register on SVTrip from the businesses page. When it registers, the business is published without prior review by the team, and whoever registers it declares that they have the right to do so.',
        'The Standard plan costs $30 a month and the Premium plan $50 a month. Current prices are always shown on the businesses page and in the app; if they change, you will see them before choosing a plan.',
        'During a launch period, businesses that register receive a Premium membership at no cost for a set time, counted from their registration date. The dates and length of that period are shown on the businesses page while it is in effect. That free membership includes everything in the Premium plan except featured placement in the catalog, which starts once you choose to pay.',
        'There is no automatic charge: SVTrip does not store payment methods and does not charge on its own. Your dashboard shows how many days of the free period you have left.',
        'When the free period ends and the business has no paid plan, after a short grace period it stops being shown to travelers. Nothing is deleted: your data and profile stay saved, and the business is shown again when a plan covers it.',
        'Whoever registers after the launch period ends does not receive the free membership, and their business is shown to travelers only when a plan covers it.',
        'To register a business you have to accept these terms and the privacy policy. We keep which version you accepted and when.',
      ],
    },
    {
      id: 'reservations-are-requests',
      heading: 'Reservations are requests',
      body: [
        'When you request a reservation through SVTrip, you are sending a request to the business. It is not a confirmed reservation: it stays pending until the business confirms it, and it may decline.',
        'SVTrip does not secure a table, a room or any place, does not manage businesses’ availability and does not charge anything for a reservation. What happens between you and the business is between the two of you.',
        'If your plans change, cancel the request from the app to let the business know.',
      ],
    },
    {
      id: 'what-we-do-not-promise',
      heading: 'What we do not promise',
      body: [
        'SVTrip is offered as it is. We do not guarantee that it will work without interruption or without errors.',
        'We are not responsible for what happens at a place, with a business or during a trip. You use the app to inform yourself, and the decisions are yours.',
        'For now the app does not process payments: we do not charge you and we do not store payment methods. If that changes, we will update these terms and the privacy policy before it happens.',
        'We may change, pause or remove features. Some, such as the artificial-intelligence guide, may be switched off.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      body: [
        'If we change these terms, we will update this text and the date above.',
        'This is the current version. The date of the last update appears at the top.',
      ],
    },
  ],
};
