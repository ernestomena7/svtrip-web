import type { LegalDocument } from './types.js';

/**
 * Privacy policy, English (feature 022). The counterpart of `privacy.es.ts`.
 *
 * **A DRAFT, NOT A LEGAL DOCUMENT** — a qualified reviewer must read it before anyone relies on it.
 * That review is outside this feature and named rather than skipped.
 *
 * Section ids and their ORDER match the Spanish exactly, and `updatedAt` is shared: the structural
 * check in `shared/tests/legal.test.ts` enforces both. **It cannot tell whether the two say the same
 * thing** — that is a human reading (T033), and no gate here pretends otherwise.
 *
 * `source` fields are in the Spanish file only. They are notes for the editor, not text a reader
 * sees, and duplicating them would only create a second place for them to drift.
 */
export const privacyEn: LegalDocument = {
  id: 'privacy',
  language: 'en',
  title: 'Privacy policy',
  updatedAt: '2026-11-25',
  sections: [
    {
      id: 'data-collected',
      heading: 'What data we keep',
      body: [
        'SVTrip keeps the information you give us and what is generated when you use the app. This section lists each kind.',
        'From your account: your email address, your first and last name, your age (not your date of birth), your gender, your country of residence and, if you choose, your marital status. If you sign in with Google, also your profile picture. If you make a reservation and leave a phone number, we save it on your profile for next time.',
        'From what you do: the places you save as favorites; the Trips you build, with their dates and the places you plan to visit; your mood preferences; and a record of which places the guide has shown you, which exists so it does not repeat itself.',
        'If you run a business: your business and subscription details (the plan, its dates and whether payment is up to date), and the requests you make to manage a business, which include your name and an optional message you write.',
        'When you register a business from the businesses page, we also keep: the address and municipality, the website and social links if you add them, the moods and type of business, the date and time of registration, whether you received the free period and when it ends, the language you used, the link you came from (for example, the one in an invitation email), and which version of the terms and of this policy you accepted and when. We send you a welcome email and keep when it was sent.',
        'When someone reports a review, we keep who reported it and the reason if they wrote one. Only the SVTrip team can see that record, and no screen in the app shows it.',
        'If you turn on notifications on your phone, we keep, with your account, the identifier Google uses to deliver notifications to that phone. We use it only to tell you about your reservations. It is deleted when you sign out on that phone, and also when it stops working. If you do not turn notifications on, we keep nothing.',
        'Your account data, favorites, Trips and conversations are stored under your account and can only be read from it.',
      ],
    },
    {
      id: 'reservations-shared',
      heading: 'What a business sees when you request a reservation',
      body: [
        'When you request a reservation, the business you ask sees your name, your email and, if you left one, your phone number, along with the date, the time, the number of people and any note you write.',
        'We do it this way because the business needs to be able to reply to you. We copy those details into the request exactly as you wrote them at that moment, so if you later change your name or delete your phone number, a request the business has already answered does not change.',
        'A reservation is a request, not a table or a room held for you: it stays pending until the business confirms it.',
        'This is the only situation in which another person sees your contact details. Everywhere else in the app, what we keep about you is private to your account.',
      ],
    },
    {
      id: 'reviews-public',
      heading: 'Reviews are public',
      body: [
        'Reviews are the only content in SVTrip that anyone can read. When you write one, it is published with your name.',
        'You can delete your own reviews from the app whenever you like. A business cannot edit or delete a review it received.',
        'A business owner can publish a public reply to a review, and that reply is shown next to it.',
      ],
    },
    {
      id: 'location',
      heading: 'Your location',
      body: [
        'If you allow it, the app reads your approximate location to order places by distance.',
        'We do not store it, we do not send it to our servers and we do not share it. It stays in the device’s memory while you use the app, and the distance is calculated there.',
        'If you would rather not share it, you can refuse: you lose the ordering by distance, but you do not lose any place.',
      ],
    },
    {
      id: 'third-parties',
      heading: 'Who we share data with',
      body: [
        'Supabase stores everything described in "What data we keep", including businesses’ photos, on servers in the eastern United States. It is our database and our account system, and there is no way to use the app without it.',
        'Our server runs on Google Cloud, also in the United States: the requests the app makes to it (for example, when you request a reservation or post a review) pass through it. If you sign in with your Google account, Google confirms who you are and gives us your name and email.',
        'If you turn on notifications, each reservation notification is delivered through Firebase Cloud Messaging, Google’s notification service for Android. Google receives your phone’s identifier and the text of the notification: for example, the business name, the date of your reservation and, if the business wrote you a message when declining it, that message.',
        'The app’s typefaces are loaded from Google Fonts. That means your IP address reaches Google every time a page loads, before anything is drawn, including on the public page where no account exists yet. We state it because it is not something you can choose.',
        'The welcome email sent to businesses goes out from comercios@svtrip.com through Hostinger, our domain and email provider, which receives your email address and the content of the message in order to deliver it.',
        'Maps are loaded from OpenFreeMap, which receives your IP address and the approximate area you are viewing each time a map is shown.',
        'If a business searches for an address to place itself, the text of that search is sent to MapTiler through our server.',
        'When you tap "Directions", the destination’s coordinates open in Google Maps. When you tap to contact a business on WhatsApp, WhatsApp opens with that business’s number. In both cases you leave SVTrip through an action of your own.',
        'If you use SVTrip from an artificial intelligence assistant (for example ChatGPT or Claude), what you ask that assistant and what SVTrip answers pass through the company that offers it, under its own terms. SVTrip does not receive the conversation: only the search the assistant makes. If you tell the assistant where you are from or who you travel with, SVTrip keeps only daily totals (for example, how many searches were by families with children), never linked to a person.',
        'We do not sell your data and we do not use it for advertising.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep your data',
      body: [
        'We have no automatic deletion period. We keep your data for as long as your account exists.',
        'This includes the conversations you had with the artificial-intelligence guide: they are stored message by message and are not deleted on their own. The guide is switched off right now, but conversations that already exist are kept, and if the guide is switched back on, the text you write will be sent to Google, our model provider, to produce each reply.',
        'The record of which places the guide has shown you is also kept.',
      ],
    },
    {
      id: 'anonymous-analytics',
      heading: 'Business statistics',
      body: [
        'Businesses see how many people looked at their profile, saved it as a favorite or tapped "Directions".',
        'Those statistics are anonymous: they record which business and what kind of interaction, and they do not record who it was. A business knows that someone saw it, never who.',
      ],
    },
    {
      id: 'your-choices',
      heading: 'Your choices and how to ask us to delete your data',
      body: [
        'You can edit your profile, favorites, Trips and moods from the app at any time.',
        'To ask us to delete your account and your data, write to comercios@svtrip.com. A person handles it by hand: there is not yet a button in the app to do it.',
        'We do not set a response time because there is no process behind it that we could measure. We would rather tell you that than promise a number we cannot keep.',
        'We do not yet offer a way to download a copy of your data.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: [
        'For any question about this policy or about your data, write to comercios@svtrip.com.',
        'SVTrip is intended for people aged 13 or over.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: [
        'If we change what we keep or who we share it with, we will update this text and the date above.',
        'This is the current version. The date of the last update appears at the top.',
      ],
    },
  ],
};
