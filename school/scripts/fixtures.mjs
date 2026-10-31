// Made-up ParentSquare emails, shaped like the real ones (school/sort.js says how they look), for School's
// tests. Every name, school, post and link here is invented: the repository is public.
const T = (s, hh = 18, mm = 0) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
const FOOT = '\n\nYou received this email because you are a ParentSquare user in Maple Grove Academy. If you received this email in error or wish to disable your account, visit https://www.parentsquare.com/schools/1/unsubscribe?from_email=true&s=x';
const LINK = n => '\n\nTo see the post and comment, please visit the following link: https://www.parentsquare.com/feeds/' + n + '?s=token' + n;
const SEP = '\n---------------------------------------------------------------------------------\n\n';

export const digest = {
  id: 'd1', threadId: 'd1', date: T('2026-10-28', 18, 38),
  subject: 'Oct 28, 2026 Digest: 5 new messages from Maple Grove Academy today',
  text: 'Daily digest created for Pat Example' + SEP
    + '1. Relief Friday - October 30th - No School\n\nPosted by Sam Ortiz on Wednesday, Oct 28 at 10:59 AM in Maple Grove Academy\n\nFriday, Oct 30\n\nOur second Relief Friday of the year is October 30, 2026. The building will be closed on Friday, Saturday, and Sunday. **THERE IS NO SATURDAY ACADEMY THIS WEEKEND**' + LINK(1001) + SEP
    + '2. Lost and Found – One Week to Claim Items!\n\nPosted by Jo Park on Wednesday, Oct 28 at 12:17 PM in Maple Grove Academy\n\nDear families,\n\nAll items will be outside the front office through&nbsp;Wednesday, November 4th.\n\nThere are 4 attachments with this post. Click the link below to view the attachments.' + LINK(1002) + SEP
    + '3. Wear Pink on THURSDAY\n\nPosted by Sam Ortiz on Wednesday, Oct 28 at 3:52 PM in Maple Grove Academy\n\nSince we will not be in school on Friday, we will have our final "Wear Pink" in October on Thursday, October 29th. Students may wear pink tomorrow instead of their regular school uniform.' + LINK(1003) + SEP
    + '4. Character Dress Up\n\nPosted by Lena Rivera on Wednesday, Oct 28 at 3:45 PM in Homeroom_Rivera\n\n **Good afternoon,&nbsp;** Thank you to all the chaperones. **Character Day Dress Up:** On Thursday, October 29, 2026 (tomorrow) Kindergarten students can dress up as their favorite character. No masks that cover the whole face.' + LINK(1004) + SEP
    + '5. 4th and 5th grade Basketball\n\nPosted by Chris Lane on Wednesday, Oct 28 at 4:10 PM in Maple Grove Academy\n\nOur 4th and 5th grade basketball season begins November 9th! Practices are Mondays and Wednesdays from 3:15-4:15 PM.' + LINK(1005)
    + '\n\n---------------------------------------------------------------------------------' + FOOT,
};
export const post = {
  id: 'p1', threadId: 'p1', date: T('2026-10-26', 9, 0), subject: 'Kindergarten Book Buddies',
  text: 'Sam Ortiz posted in Kindergarten\n\nKindergarten Book Buddies\n\nKindergarten parents, Ms. Rivera is starting Book Buddies on Fridays from 3:15-3:50. Please fill out this form to sign your child up by Friday, November 6: [Sign-Up Form](https://forms.gle/madeup) ![](https://posts.parentsquare.com/inline_images_madeup.png)' + LINK(1101) + FOOT,
};
export const event = {
  id: 'e1', threadId: 'e1', date: T('2026-10-27', 8, 13), subject: 'Upcoming Event: November Movie Night, on Friday, Nov 13 at 4:00 pm',
  text: ' Coming up on: November Movie Night\n\n  Coming up on: Friday, Nov 13\n\n  Dear families, our movie night is Friday, November 13th. All items are CASH only. Please plan on picking up students no later than 6:00 pm.\n\n  Please RSVP for this event.\n\nView Event https://www.parentsquare.com/feeds/1201?s=x\n\nPlease do not reply to this email.' + FOOT,
};
export const rsvp = {
  id: 'r1', threadId: 'r1', date: T('2026-10-26', 8, 0), subject: 'Reminder to RSVP for: November Movie Night',
  text: 'Reminder to RSVP for: November Movie Night\n\nComing up on Friday, Nov 13.\n\nView Event https://www.parentsquare.com/feeds/1201?s=x' + FOOT,
};
export const rsvpYes = {
  id: 'r2', threadId: 'r2', date: T('2026-10-27', 8, 0), subject: "Reminder: You RSVP'd YES for: November Movie Night, on Friday, Nov 13 at 4:00 pm",
  text: 'Coming up on: November Movie Night\n\nYou RSVP’d Yes.\n\nView Event https://www.parentsquare.com/feeds/1201?s=x' + FOOT,
};
export const signup = {
  id: 's1', threadId: 's1', date: T('2026-10-25', 19, 5), subject: 'Week 13 Newsletter_Important Updates (READ)',
  text: 'Reminder that Lena Rivera shared a sign up in Homeroom_Rivera\n\nWeek 13 Newsletter_Important Updates (READ)\n\nLena Rivera still needs 1 item. Click the link below to sign up.\n\nThank you to these people for signing up\n      A. Parent\n      B. Parent\n\nTo see the post and sign up, please visit the following link: https://www.parentsquare.com/feeds/1301?s=x',
};
export const message = {
  id: 'm1', threadId: 'm1', date: T('2026-10-08', 12, 49), subject: 'New message from Lena Rivera in Maple Grove Academy',
  text: 'Lena Rivera replied to your conversation.\n\nCan she wear pink tomorrow? Yes, every Friday this month.\n\nView or Reply in App: https://www.parentsquare.com/users/1/chats/2?target_user_id=1\n\n  Previous Message:\n  On Thursday, Oct 8 at 7:14 AM, Pat Example wrote:\n    Is tomorrow a pink day?\n\nMessage sent on Thursday, Oct 8 at 12:49 PM to Pat Example' + FOOT,
};
export const receipt = {
  id: 'pay1', threadId: 'pay1', date: T('2026-10-07', 19, 1), subject: 'Payment Receipt for Payment for Kindergarten Field Trip on October 28th',
  text: 'Maple Grove Academy\n\nThank you for your payment: Payment for Kindergarten Field Trip on October 28th\n\nPayment Receipt\n---------------\n\nReceipt Date: Oct 07, 2026\nInvoice Number: 1234\nPayment Method: Visa 0000\n\nStudent: N/A\nSchool: Maple Grove Academy\nParent/Guardian: Pat Example\n\nPayment Details:\n1 x Field Trip Payment - N/A : $37.00\n\n--------------\n\nTotal: $37.00',
};
export const report = {
  id: 'rep1', threadId: 'rep1', date: T('2026-10-13', 16, 2), subject: 'Ava Example: T1 Report Card',
  text: 'Maple Grove Academy\n\nPlease see the attached file for a copy of the Term 1 Report Card for your student. Thank you!\n\nView Document https://www.parentsquare.com/documents/1?s=x\n\nPlease do not reply to this email.' + FOOT,
};
export const clubOff = {
  id: 'c1', threadId: 'c1', date: T('2026-10-25', 20, 6), subject: 'No club on Nov 3rd',
  text: 'Dana Fox posted in Calm Kids Club\n\nNo club on Nov 3rd\n\nHello Parents, there is no club on Tuesday, Nov 3rd as I have a meeting. Sorry for the inconvenience.' + LINK(1401) + FOOT,
};
export const clubHello = {
  id: 'c2', threadId: 'c2', date: T('2026-09-01', 10, 0), subject: 'Hello from Calm Kids Club!',
  text: 'Dana Fox posted in Calm Kids Club\n\nHello from Calm Kids Club!\n\nWe meet every Tuesday from 3:15-3:50 in Room 12.' + LINK(1402) + FOOT,
};
export const picture = {
  id: 'w14', threadId: 'w14', date: T('2026-10-29', 9, 0), subject: 'Week 14 Newsletter',
  text: 'Lena Rivera posted in Homeroom_Rivera\n\nWeek 14 Newsletter\n\n ![](https://posts.parentsquare.com/inline_images_madeup-Week+14+Newsletter.jpg)' + LINK(1501) + FOOT,
};
export const newsletter = {
  id: 'n1', threadId: 'n1', date: T('2026-10-25', 17, 13), subject: 'Maple Grove Times 10/25/2026',
  text: 'Maple Grove Times 10/25/2026\n\n## Maple Grove Times\n\n|\nOctober 25, 2026\n |\n\n## Greetings, families!\n\n🎉&nbsp; **Relief Friday – No Classes on October 30!**\n\n## Upcoming Events\n\n📅&nbsp; **Upcoming Events: Please add these important dates to your family calendar:**\n\n**October**\n\n'
    + '- **October 27–29** &nbsp;👻 – Boo Buddies Festivities\n- **October 30** &nbsp;🌟 – Relief Friday (No School)\n\n**November**\n\n'
    + '- **November 6** &nbsp;💼 – STEAM Identity Day Events\n- **November 11** &nbsp;🇺🇸 – Observance of Veterans Day (No School)\n- **November 13** &nbsp;💜 – Observance of Veterans Day / Wear Purple / Kindness Day\n'
    + '- **November 18** &nbsp;🎶 – Autumn Music Showcase at 6:00 PM\n- **November 23–27** &nbsp;🍂 – Fall Break (No School)\n\n**December**\n\n- **December 1–11 📊 – Winter MAP Testing Window**\n- **Winter Break:&nbsp;** December 21 - January 1\n\n'
    + '## Book Character Day will be Wednesday, October 28th!\n\nStudents are invited to dress up as their favorite book character and bring the book that represents their character to share!\n\n'
    + '## 🔬Save the Date – 🚀 STEAM Identity Day – November 6!\n\nWe are excited to announce **STEAM Identity Day on November 6!** Scholars will explore science, technology, engineering, arts and math with real-world professionals.\n\nParents who would like to host a table can contact the front office.\n\nSave the Date: November 6, 2026!\n\n'
    + '## Autumn Music Showcase\n\nJoin us on November 18 at 6:00 PM in the gym for the choir and band.\n\n'
    + '## Reading Log\n\nPlease make sure your child reads at least 20 minutes, five days a week.\n\nThere are 3 attachments with this post.' + LINK(1601) + FOOT,
};
export const ALL = [digest, post, event, rsvp, rsvpYes, signup, message, receipt, report, clubOff, clubHello, picture, newsletter];
