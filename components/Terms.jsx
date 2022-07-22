
import React, { useState, useEffect, useReducer, useMemo } from 'react';
import { useRouter } from 'next/router';
import { observer } from 'mobx-react';
import useUserStore from './hooks/useUserStore';
import { showError, showSuccess } from '../lib/services/alertService';
import { ROUTES } from '../lib/constants/routing';


const Terms = observer(() => {
  const {
    pathname,
    query: { project, remix },
    push,
  } = useRouter();
  const userStore = useUserStore();
  const { updateUser } = userStore;
  const [termState, setTermsState] = useState(false);

  const onUpdateTerms = async () => {
    setTermsState(true);
    try {
      setTermsState(true);
      await updateUser({ svrTerms: true });
      showSuccess('Terms updated successfully').then(() => {
        push(
          {
            pathname: ROUTES.edit,
          },
          undefined,
          { shallow: true },
        );
      });
      push(
        {
          pathname: ROUTES.edit,
        },
        undefined,
        { shallow: true },
      );
    } catch (e) {
      showError(e.message);
    }
  };

  return (
    <>
      <div className="terms-body">
        <div>

          <div className="terms-content">
            <p className="terms-header text-center"> TERMS OF SERVICE</p>
            <div>


              The following terms and conditions (the “Terms”) govern your access to,
              and use of, the Video Platform’s cloud-based video creation and management
              console software and related code, documentation, features,
              and services, as well as any fixes, updates or upgrades thereto
              (collectively, the “Console“). Therefore, please read these Terms carefully
              since they set out the legal rights and obligations between you and our company.
              (together with our respective affiliates and subsidiaries,
              “we“, “our” or “us“) with respect to the subject matter hereof.

              <br />
              <br />

              BY ACCESSING OR USING ANY PART OF THE CONSOLE, YOU ACKNOWLEDGE THAT YOU HAVE REVIEWED,
              AND YOU AGREE TO BE BOUND BY, THESE TERMS AND OUR PRIVACY POLICY.
              IN ADDITION, IF YOU ARE ACTING ON BEHALF OF AN ENTITY, Y
              OU REPRESENT THAT YOU ARE AUTHORIZED TO ACT ON BEHALF OF,
              AND BIND, SUCH ENTITY TO THESE TERMS. IF YOU DO NOT AGREE TO THESE TERMS,
              YOU MAY NOT ACCESS OR USE ANY PART OF THE CONSOLE.
              YOU AGREE THAT ANY CAUSE OF ACTION THAT YOU MAY HAVE ARISING OUT OF OR RELATED TO THE
              CONSOLE (OR ANY PART THEREOF) MUST COMMENCE WITHIN ONE (1)
              YEAR AFTER THE CAUSE OF ACTION ACCRUES. OTHERWISE,
              SUCH CAUSE OF ACTION SHALL BE PERMANENTLY BARRED.
              <br />
              <br />

              1. Background. We make the Console available under these Terms to those of our customers ("Customers", “you”, or “your”). The Console may be used for the creation, design, generation and delivery of audiovisual works or clips through our proprietary video platform and player (the "Video Platform"), and our Customers' respective authorized personnel ("Customer Users"), agents and representatives, such as advertising agents (such agents and representatives, collectively, "Agents").
              <br />
              <br />

              2.  Modification. We reserve the right, at our discretion, to modify these Terms at any time by sending an email to our Customers or by publishing the modified Terms within the Console dashboard. Such modification(s) will be effective ten (10) days following such notification or publication, and your use of any part of the Console thereafter means that you accept those modifications and the new version of these Terms. When we modify these Terms, the "Last Updated" date above will be updated to reflect the date of the most recent version. We encourage you to review these Terms periodically.
              <br />
              <br />

              3. Accounts. In order to access and use the Console you will first need to register an account ("Account") by purchasing a subscription and completing the registration process. You must complete the registration process by providing us with information that is (and you must ensure that it remains) current, complete and accurate (such as your name, entity information, and email), and you will then be required to create a password for the Account. You acknowledge and agree that we have the ability, but not the obligation, to access your Account in order to provide support, maintenance, improvement, business, and/or security-related services. You are solely responsible for (a) protecting your Account user name and password; and (b) any and all activities that occur under or through your Account. You must notify us immediately if you become aware of, or suspect, any security breach or unauthorized access to your Account. If you allow a third party to access your Account on your behalf, you are responsible for ensuring that such third party has consented to, and complies with, these Terms. If you wish to cancel your Account, you must contact our support desk to request such cancellation, unless otherwise Console. Please be aware, however, that once your Account has been cancelled (i) you will lose all access to and use of the Console and any data or information stored in your Account; and (ii) you may still be subject to these Terms, as further described in Section ‎15 (Termination and Survival) below.
              <br />
              <br />

              4. Access and Restrictions. Subject to your compliance with these Terms, we hereby grants you a limited, revocable, non-exclusive, non-sublicensable, and non-transferable right to remotely access and use the Console. As a condition to the foregoing you agree not (and shall not allow any third party) to:
              copy, distribute, rent, lease, lend, use for timesharing or service-bureau services, commercially host, export, modify, adapt, translate, enhance, customize, or otherwise create derivative works of, the Console or any part thereof;
              reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of, the Console or any part thereof, except as expressly permitted by the law in effect in the jurisdiction in which you are located;
              remove or modify any proprietary notices, labels or legends on or in the Console;
              use any automated means to access or use the Console, or circumvent or disable any security or technological features of the Console;
              use, post, transmit or introduce any device, code, routine or other item (including without limitation bots, viruses, worms, and Trojan horses) that interferes (or attempts to interfere) with the operation or integrity of the Console;
              use the Console to design or develop any product or service that competes with the Console or our business, or use the Console for any unlawful or fraudulent purpose, to breach these Terms, or to infringe or misappropriate any third party intellectual property, privacy, or publicity right;
              take any action that imposes or may impose, as determined in our sole discretion, a disproportionately large load on the Console infrastructure;
              publicly disclose the results of any Console benchmark (or similar comparison) test, without our express prior written approval;
              use the Console in connection with any product or service that are directed at children under the age of 13 (including when you should have been aware of this); or
              Use the Console in a manner inconsistent with its then-current documentation.

              <br />
              <br />

              5. License to Data and Video Interfaces. As a Customer, you hereby grant us a royalty-free, paid-up, non-exclusive, irrevocable and worldwide license to access, log, retain and use all Consumer Data and Video Interfaces pertaining to your Account, as well as all other data and content you provide to us, to: (a) administer and make improvements to the Console, as well as carry out related tasks (such, but not limited to, billing); (b) generate videos; (c) collect and analyze Consumer Engagement Data (defined below) and Video Interfaces; and (d) compile statistics, metrics, insights, and general trend data about the Console for, among other things, our marketing and promotional purposes, all in accordance with our Privacy Policy. For clarity, as between you and us, all Consumer Data and Video Interfaces shall be solely and exclusively owned by you. As used herein, “Consumer Engagement Data” means any data pertaining to Consumers’ engagement (such as, without limitation, click-to-play events, percentage of video viewed, and click-through rates).
              Payments & Refunds. Your access to and use of the Console and any other products or features is provided at no additional charge to you under these Terms, but is expressly subject to your continued and timely payment in full of all applicable fees, taxes and other charges.
              We follow a reliable refund policy to let our customers feel privileged about their association with us. Please read the guidelines governing the refund policy.
              a. Our refund policy varies by price of product for yearly and onetime transactions:
              - Products priced $197 and above may have a 7 days refund policy.
              - Products priced $196 and below may have a 10 days refund policy.
              - Some Special Product launches may have a 30 days refund policy.
              - Features/Add-ons will have a 0 day or no-refund policy— unless otherwise explicitly stated.
              We will refund your payment in full for all valid request received within the refund period of the product.  All refund requests must be made via our support chat box or via email to support@videoremix.io.
              - Monthly recurring transactions ("Individual Paid Service" subscriptions) are non-refundable, and no prorated refunds or credits will be offered for partially used subscriptions. However, if we issue a refund or credit in one instance, we are under no obligation to issue the same refund or credit in the future.

              b. For products/services that are under a yearly recurring payment, you can cancel your subscription at any time before the next renewal date. We provide a full refund for ONLY the first payment in a yearly recurring subscription if asked within the refund period (see point a. above). If you wish to cancel your subscription, please notify us at least 3 days before the end of your current term (via an email to support@videoremix.io) . Upon cancellation, your account access will be revoked at the end of the current billing cycle. Your campaigns will stop running and access to such content will be removed. Rebilled subscriptions will not be refunded if no notice of cancelation is received 3 days before the renewal date. All payments are made in advance of the services delivered.
              Your subscription gets renewed automatically every month/year according to the date of first purchase and terms agreed before checkout.

              c. All refund request MUST include the following information:
              - Product name (The product/service you are requesting refunds for)
              - Transaction ID (The transaction ID)
              - Associated account email address
              All refunds request are deemed as valid (as long as it complies with our refund policy above) once your email is delivered to our support channel. We will provide a refund for all valid requests even if such request came in outside of our normal support hours or during weekends. Please note that refunds request to any other email address except to the email address stated above does not pass as a valid refund request.
              Free Trial. We may permit certain Users to create an Account and use the Console on a limited trial basis, free of charge until the earlier of: (a) the end of the trial period (as determined by us), or (b) the start date of your paid subscription. If we include additional terms and conditions on the trial registration web page, those will apply in addition to these Terms. (In the event of any conflict, those additional terms will prevail over these Terms.) Unless you register for your paid subscription before the end of the trial period, all of your data and other work product contained in your Account will be permanently deleted at the end of the trial, and we will be under no obligation to recover it. You also acknowledge and agree that we reserves the right to suspend, modify, cancel and/or limit the trial basis and/or period, in any way and at any time.
              Privacy. You must not (and shall not allow any third party to) use the Console to track, collect or upload any data that personally identifies an individual (such as, but not limited to, a name, email address, or billing information) in violation of any applicable law or regulation. You must have, and at all times comply with, an appropriate privacy policy that conforms to the laws of your jurisdiction.
              Feedback. The Console may include tools giving you the opportunity to provide us with feedback data (such as, but not limited to, comments, suggestions, and questions) about the Console ("Feedback""). You agree that all rights, title and interest in and to all Feedback (even if provided to us other than through the Console tools) are and shall remain our sole and exclusive property.
              Support. In conjunction with any technical support and extended support to which you may be entitled to, we provide email support for your use of the Console under these Terms only through our support desk. In the event a Customer requires any additional assistance, extended support or other professional services from us, such an arrangement is not possible.
              Ownership.
              General. All rights not expressly granted under these Terms are hereby reserved by us and/or our licensors. In addition, the rights granted by us to you under these Terms shall terminate immediately upon the earlier of the termination of these Terms (as described in Section ‎15 below) or your breach of any provision of these Terms.
              Console. All rights, title and interest in and to the Console and its features (such as, but not limited to, graphics and interface), including all reproductions, corrections, modifications, customizations, enhancements and improvements thereof, as well as all related patent rights, copyrights, trade secrets, trademarks, service marks, goodwill, and intellectual property rights, are and shall remain our sole and exclusive property and/or our licensors.
              Confidentiality. Both us and you may have access to certain non-public and/or proprietary information of the other, in any form or media, including without limitation trade secrets, technical data, technology, know-how, software codes and designs, price lists, and developments ("Confidential Information"). You acknowledge and agree that the Console is or contains Confidential Information of our company. Each party shall take measures at least as protective, but in no event less than a reasonable standard, as those taken to protect its own Confidential Information, to safeguard the Confidential Information of the other party from unauthorized disclosure and use. You may only use our Confidential Information to the extent explicitly granted under these Terms (if any), and you may only disclose our Confidential Information to your employees who have a need to know such Confidential Information and who are subject to written confidentiality undertakings at least as protective of our Confidential Information as set forth herein. All right, title and interest in and to Confidential Information are and shall remain the sole and exclusive property of the party disclosing it hereunder. In the event that either you or we (the "Recipient") are required by law, regulation, judicial order or other administrative or legal requirement to disclose the disclosing party's (the "Discloser") Confidential Information, the Recipient agrees to notify the Discloser immediately in writing, unless otherwise prohibited by such law, regulation, order or requirement. Upon termination of these Terms (as described in Section ‎15 below), each party shall promptly return or destroy all Confidential Information of the other party and, upon request, certify same in writing.
              Compliance with Laws. You agree to comply with all applicable international, national, state, regional and local laws and regulations in accessing and/or using the Console (or any part thereof) and in performing your obligations and exercising your rights under these Terms, including without limitation laws relating to privacy, data protection, and exports.
              b. You are solely responsible for sites and images you use with the platform. We are not responsible for terms of use or copyright compliance.
              Representations and Warranties. You hereby represent and warrant that (a) you possess and shall maintain all rights, licenses and consents required to license to us the Consumer Data and Video Interfaces on the terms described in Section ‎5 above and that such license does not infringe or misappropriate the intellectual property, privacy, and/or publicity rights of any third party; (b) you possess and shall maintain all governmental and administrative licenses, permits and approvals necessary to use the Console and to perform your obligations and exercise your rights under these Terms; and (c) all Video Interfaces will (i) be free from any viruses, Trojan horses, worms, or other malicious code or items, (ii) not contain obscene language, pornography (or other adult-only content), defamatory, racist or similar content, (iii) not constitute a tort against any third party, and/or (iv) not infringe or misappropriate the intellectual, privacy or publicity rights of any third party.
              Termination and Survival.
              By us. You acknowledge and agree that we may at any time, for any reason, and without notice to you: (a) discontinue or modify any aspect of the Console; and/or (b) suspend or terminate your, or general, access to the Console (or any part thereof), and in such an event we shall not be liable to you or any third party for any loss, damage, or injury resulting or arising therefrom. Our termination of your, or general, access to, the Console shall constitute our termination of the Terms, and any Account you may have shall become cancelled upon such termination (except for a thirty (30) day period thereafter during which we will, upon your written request, grant you temporary access to your Account in order to retrieve any Consumer Data and/or Video Interfaces therein).
              By us. If your account stays inactive for 24 or more month, we may terminate your account and you won't be eligible for a refund for any pre-paid sums or compensation for unused credits if your account is terminated. You understand and agree that upon termination of your account, we may permanently erase your account and any related data, including your campaigns and projects.

              By You. If you object to any term or condition of these Terms, or become dissatisfied with the Console in any way, your only recourse and sole remedy is to cancel your Account ("Account Cancellation") and immediately cease using the Console. Cancelling your Account shall constitute your termination of the Terms. You agree, however, that any Account Cancellation shall not derogate from any payment obligations you may have toward us under these Terms.
              Survival and Effect of Termination. Sections ‎5, ‎6, ‎‎11, ‎‎12, ‎‎14, 15, ‎‎16, ‎‎17, ‎‎18, ‎‎20, ‎‎21, 22 and ‎‎23 shall survive any termination of these Terms. Upon any termination of these Terms all rights granted to you under these Terms shall become immediately revoked, and you undertake to immediately cease all use of the Console.
              Disclaimer of Warranties.
              You assume all responsibility for the selection of the Console to achieve your intended results. You also acknowledge and agree that the below exclusions and disclaimers are an essential part of these Terms. Applicable law may not allow the exclusion of certain warranties, so to that extent such exclusions may not apply. References below to the "CONSOLE" include the Console as a whole as well as each part thereof.
              THE CONSOLE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, AND YOU ACKNOWLEDGE THAT THERE ARE NO REPRESENTATIONS, WARRANTIES OR CLAIMS OF ANY KIND MADE BY US WITH RESPECT TO THE CONSOLE, WHETHER EXPRESS, IMPLIED OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF QUALITY, PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE, OR OTHERWISE ARISING FROM A COURSE OF DEALING OR USAGE OF TRADE.
              WE DO NOT WARRANT THAT THE CONSOLE WILL OPERATE UNINTERRUPTED, ERROR FREE, ACCORDING TO YOUR NEEDS, OR THAT DEFECTS WILL BE CORRECTED. WE DO NOT OFFER A WARRANTY OR MAKE ANY REPRESENTATION OR CLAIM REGARDING ANY CONTENT, MATERIALS, INFORMATION, OR RESULTS THAT YOU CREATE OR OBTAIN THROUGH THE CONSOLE (SUCH AS THE LIKELIHOOD OF INCREASING CONSUMER RETENTION, ENGAGEMENT OR REVENUES). YOUR USE OF, AND RELIANCE UPON, THE CONSOLE, IS ENTIRELY AT YOUR SOLE DISCRETION AND RISK, AND WE SHALL HAVE NO RESPONSIBILITY OR LIABILITY WHATSOEVER TO YOU IN CONNECTION WITH ANY OF THE FOREGOING.
              YOU AGREE THAT WE WILL NOT BE HELD RESPONSIBLE OR LIABLE FOR ANY CONSEQUENCES TO YOU OR ANY THIRD PARTY THAT MAY RESULT FROM TECHNICAL PROBLEMS OF THE INTERNET, SLOW CONNECTIONS, SYSTEM FAILURE, OUTAGES, TRAFFIC CONGESTION, OVERLOAD OF OUR OR OTHER SERVERS, OR OTHER EVENTS BEYOND OUR REASONABLE CONTROL.
              Limitation of Liability. NOTWITHSTANDING ANY OTHER PROVISION IN THESE TERMS, AND TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW:
              WE WILL NOT BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, PUNITIVE OR SPECIAL DAMAGES OF ANY KIND, OR FOR YOUR, OR ANY THIRD PARTY'S, LOSS OF PROFITS, REVENUES, BUSINESS OPPORTUNITY, OR DATA, ARISING OUT OF THESE TERMS OR IN CONNECTION WITH THE USE OF, OR INABILITY TO USE, THE CONSOLE (OR ANY PART THEREOF), WHETHER BASED ON A CLAIM OR ACTION IN CONTRACT, TORT (INCLUDING NEGLIGENCE) STRICT LIABILITY, BREACH OF STATUTORY DUTY, OR OTERHWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES, AND EVEN IF DIRECT DAMAGES DO NOT SATISFY A REMEDY.
              OUR AGGREGATE LIABILITY TO YOU OR ANY THIRD PARTY FOR ANY LOSS AND/OR DAMAGES UNDER THESE TERMS OR IN CONNECTION WITH THE USE OF, OR INABILITY TO USE, THE CONSOLE (OR ANY PART THEREOF), SHALL NOT EXCEED THE TOTAL AMOUNT OF FEES PAID BY YOU TO US (IF ANY) HEREUNDER IN THE TWELVE (12) MONTHS PRIOR TO BRINING THE CLAIM.
              Indemnity. You agree to defend and hold us harmless, our directors, officers, employees, agents and partners (each, an "Indemnified Party"from and against any and all third-party claims, demands, actions and/or proceedings based upon or arising out of (i) your use of the Console (or any part thereof), (ii) your breach of any of these Terms, and/or (iii) your violation of a third party right or applicable law or regulation (each, a "Claim"), and you agree to indemnify and pay the Indemnified Party for any and all damages, obligations, losses, liabilities, penalties, fines, costs and expenses (including but not limited to reasonable attorneys' fees) incurred by the Indemnified Party in connection with the Claim, or in the settlement or avoidance of the Claim. We will notify you of any Claim that is subject to the foregoing obligation. The Indemnified Party shall cooperate in any defense and settlement and may participate in such defense at its own expense. You agree not to enter into any settlement of, or admit any wrongdoing under, any Claim without the Indemnified Party's prior written consent, which shall not be unreasonably withheld.
              U.S. Government Rights. If the use of the Console is being acquired by or on behalf of the U.S. Government or by a U.S. Government prime contractor or subcontractor (at any tier), in accordance with 48 C.F.R. 227.7202-2 (for Department of Defense acquisitions) and 48 C.F.R. 2.101 and 12.212 (for non-Department of Defense acquisitions), the Government's rights in the Console, including its rights to use, modify, reproduce, release, perform, display or disclose the Console (or any part thereof), will be subject in all respects to the commercial license rights and restrictions provided under these Terms.
              Publicity. You agree that we may use your company logo on our customer list and website to disclose that you are a licensee and customer.
              Assignment. You may not assign these Terms, delegate any duty or assign any right hereunder without our prior express written consent. Any such attempted assignment or delegation that does not comply with the foregoing shall be null and void. We may assign or transfer these Terms, delegate any duty and/or assign any right hereunder to any third party. These Terms will bind and benefit the respective successors and assigns of the parties hereto.
              General.
              Entire Agreement. These Terms, together with any annexes, schedules and/or exhibits attached hereto, constitute the entire agreement between you and us with respect to the subject matter hereof, and supersede any prior or contemporaneous agreements or understandings between you and us.
              Relationship. The relationship between you and us is solely that of independent contractors. Nothing in these Terms shall be construed to create a partnership, joint venture, employment or agency relationship.
              Governing Law. These Terms shall be governed by, and construed in accordance with, the laws of Hong Kong, without regard to their conflicts of law rules and principles. The United Nations Convention on Contracts for the International Sale of Goods shall not apply to, and is expressly excluded from, these Terms.
              Jurisdiction and Venue. You agree that any action, proceeding, controversy or claim (each, a "Dispute") under or arising out of these Terms, between you and us, shall be brought and resolved only in the courts located in Hong Kong, Hong Kong, and you hereby irrevocably submit to the personal jurisdiction and venue of such courts with respect to a Dispute. Notwithstanding the foregoing, equitable relief may be sought in any court of competent jurisdiction.
              Equitable Relief. You acknowledge that a breach, threatened breach, and/or intended breach by you of certain provisions under these Terms (including without limitation Sections ‎4, ‎10, and ‎11) will result in irreparable injury and harm to us for which there may be no adequate remedy at law, and that we shall be entitled to appropriate equitable relief (including, without limitation, preliminary and permanent injunctions) in any court of competent jurisdiction.
              Severability. In the event any provision of these Terms is ruled to be invalid, illegal or unenforceable, the validity, legality and enforceability of the remaining provisions shall not in any way be affected or impaired, and a valid, legal and enforceable provision of similar legal intent and economic impact shall be substituted therefor.
              Headings. Section headings used in these Terms are inserted for convenience only and shall not be used in the interpretation of these Terms.
              Waiver. No failure or delay on the part of either party hereto in exercising any right, power or remedy hereunder shall operate as a waiver thereof, nor shall any single or partial exercise of any such right, power or remedy preclude any other or further exercise thereof or the exercise of any other right, power or remedy. Any waiver granted hereunder must be in writing and shall be valid only in the specific instance in which given.
              YouTube Terms of Service You agree that you have read the YouTube Terms of Service and you will not use the Video Platform in a way that violates the YouTube terms of service. This includes but is not limited to ensuring that the YouTube logo and any ads are not covered up or disrupted when using YouTube videos in conjunction with the Video Platform.

              The Video Platform provides the following features to customers using the service

              Custom video player
              Realtime analytics

              For YouTube videos, the Video Platform uses the official YouTube API to power the service. From YouTube's @Terms of Service and @Using the YouTube APIs to Build Monetizable Applications, the following is relevant from Section 2: Commercial Use:

              (permitted) "the placement of Your own branding on the API Client, provided that it does not interfere with YouTube audiovisual content playback or with any YouTube branding." (the Video Platform does not cover the YouTube watermark, the area for non-linear ads, and does not block clicks)
              (no terms prohibiting collecting analytics on your site)
              (permitted) using the YouTube API to show YouTube content on an ad-enabled API Client (such as an ad-enabled blog or website), subject to the advertising restrictions
              the sale of advertising, sponsorships, or promotions placed on or within the YouTube audiovisual content or player
              the sale of advertising, sponsorships, or promotions on any page of the API Client containing YouTube audiovisual content, unless other content not obtained from YouTube appears on the same page and is of sufficient value to be the basis for such sales.

              Regarding advertisements, the two prohibitions also apply to placing banner ads around a normal YouTube embed. This is clarified in the Monetization Guidelines:

              Note: If the only reason people go to a page is to watch a video, you should not run ads on that page. If you don't know whether you can display ads on a page, consider whether you would still be able to sell the ad inventory if you removed the video and all references to the video from the page. If so, then you can probably display ads on the page.

              In order to place ads, consult with YouTube directly.
            </div>

            <div className="flex items-center  justify-content-between">
              <div>
                {/* <input type="radio" /> */}
              </div>
              <button onClick={onUpdateTerms} className="btn btn-lg text-white bg-danger ">
                Agree
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
});


export default Terms;
