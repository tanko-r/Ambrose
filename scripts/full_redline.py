#!/usr/bin/env python3
"""
Comprehensive Contract Redlining Script

Compares target document against preferred form and generates
a thorough redline with imported language and new protections.
"""

import json
import re
from pathlib import Path
from datetime import datetime
from copy import deepcopy


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ============================================================
# PREFERRED FORM LANGUAGE SNIPPETS
# Extracted from the Seller PSA preferred form
# ============================================================

PREFERRED_LANGUAGE = {
    # Knowledge definition
    "seller_knowledge_definition": '''For purposes of this Agreement, whenever a representation is qualified by the phrase "to the best of Seller's knowledge", "to Seller's actual knowledge", "to Seller's knowledge" or by words of similar import, the accuracy of such representation shall be based solely on the actual (as opposed to constructive or imputed) knowledge of David Quigley (the "Designated Seller Representative"), without independent investigation or inquiry and without any duty to conduct any investigation or inquiry.''',

    # Anti-sandbagging
    "anti_sandbagging": '''Notwithstanding anything to the contrary in this Agreement, if, prior to Closing, Purchaser obtains knowledge that any of the representations or warranties made herein by Seller are untrue, inaccurate or incorrect in any material respect, and Purchaser nevertheless elects to proceed to Closing, then Purchaser shall be deemed to have waived any right to assert a claim against Seller with respect to such representation or warranty after Closing.''',

    # As-is acknowledgment
    "as_is_clause": '''PURCHASER ACKNOWLEDGES AND AGREES THAT, EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, SELLER HAS NOT MADE, DOES NOT MAKE AND SPECIFICALLY DISCLAIMS ANY REPRESENTATIONS OR WARRANTIES OF ANY KIND OR CHARACTER WHATSOEVER, WHETHER EXPRESS OR IMPLIED, ORAL OR WRITTEN, PAST, PRESENT OR FUTURE, WITH RESPECT TO THE PROPERTY, INCLUDING, BUT NOT LIMITED TO, WARRANTIES OR REPRESENTATIONS AS TO (A) MATTERS OF TITLE, (B) ENVIRONMENTAL MATTERS RELATING TO THE PROPERTY OR ANY PORTION THEREOF, (C) GEOLOGICAL CONDITIONS, (D) ZONING OR TAX MATTERS, (E) AVAILABILITY OF ACCESS, INGRESS OR EGRESS, (F) OPERATING HISTORY OR PROJECTIONS, (G) VALUATION, (H) GOVERNMENTAL APPROVALS, (I) GOVERNMENTAL REGULATIONS OR ANY OTHER MATTER OR THING RELATING TO OR AFFECTING THE PROPERTY. PURCHASER FURTHER ACKNOWLEDGES THAT THE PURCHASE PRICE REFLECTS THE AS-IS, WHERE-IS NATURE OF THIS SALE.''',

    # Purchaser release
    "purchaser_release": '''Purchaser, on behalf of itself and its successors and assigns, hereby fully and irrevocably releases Seller and Seller's members, managers, officers, directors, employees, agents, representatives, and affiliates (collectively, "Seller Parties") from any and all claims, demands, causes of action, losses, damages, liabilities, costs and expenses (including attorneys' fees) that Purchaser may now have or hereafter acquire against any of the Seller Parties arising from or related to (a) the physical condition of the Property, (b) any latent or patent defects or environmental conditions affecting the Property, or (c) any other state of facts that exist with respect to the Property. This release includes claims of which Purchaser is presently unaware or which Purchaser does not presently suspect to exist.''',

    # Liability cap
    "liability_cap": '''Notwithstanding anything to the contrary in this Agreement, Seller's aggregate liability for all claims arising out of or relating to this Agreement, including without limitation any breach of Seller's representations and warranties, shall not exceed Three Hundred Thousand Dollars ($300,000.00) in the aggregate (the "Liability Cap"). Purchaser agrees that the Liability Cap is a material term of this Agreement and that Seller would not have agreed to sell the Property without such limitation.''',

    # Survival limitation
    "survival_clause": '''The representations and warranties of Seller set forth in this Agreement shall survive the Closing for a period of nine (9) months (the "Survival Period"). No claim for breach of any representation or warranty shall be actionable unless written notice of such claim is delivered to Seller prior to the expiration of the Survival Period.''',

    # No recourse
    "no_recourse": '''Notwithstanding anything to the contrary in this Agreement, Purchaser agrees that it shall have no recourse against any member, manager, officer, director, employee, agent, or representative of Seller, and that Purchaser shall look solely to Seller's interest in the Property and the proceeds thereof for the satisfaction of any claims arising under this Agreement.''',

    # Materiality threshold for reps
    "materiality_threshold": '''Notwithstanding anything to the contrary herein, Purchaser shall not be entitled to assert any claim against Seller for breach of representation or warranty unless (a) the aggregate amount of all such claims exceeds Twenty-Five Thousand Dollars ($25,000.00) (the "Basket"), in which event Purchaser may recover all such claims (including amounts within the Basket), and (b) Purchaser provides written notice of such claim to Seller within the Survival Period.''',

    # Closing condition vs default language
    "closing_condition_not_default": '''The foregoing shall be a condition to Purchaser's obligation to close and not a covenant or representation, and Seller's failure to satisfy such condition shall not constitute a default hereunder.''',

    # Sole remedy limitation
    "sole_remedy": '''The remedies set forth in this Section shall be Purchaser's sole and exclusive remedies for any breach or default by Seller under this Agreement.''',

    # Limitation on consequential damages
    "no_consequential": '''IN NO EVENT SHALL SELLER BE LIABLE FOR ANY CONSEQUENTIAL, PUNITIVE, SPECULATIVE, OR SPECIAL DAMAGES, REGARDLESS OF WHETHER SUCH DAMAGES ARE FORESEEABLE OR WHETHER SELLER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.''',

    # Waiver of jury trial
    "jury_waiver": '''EACH PARTY HEREBY WAIVES, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ANY RIGHT IT MAY HAVE TO A TRIAL BY JURY IN ANY LEGAL PROCEEDING DIRECTLY OR INDIRECTLY ARISING OUT OF OR RELATING TO THIS AGREEMENT.''',
}


class ComprehensiveRedliner:
    """Applies comprehensive redlines comparing target to preferred form."""

    def __init__(self, target_doc, preferred_doc, context):
        self.target = target_doc
        self.preferred = preferred_doc
        self.context = context
        self.changes = []
        self.current_section_header = None
        self.sections_with_changes = set()

    def run(self):
        """Execute the full redlining process."""
        revised_content = []

        for item in self.target['content']:
            if item['type'] == 'table':
                revised_item = self._process_table(item)
                revised_content.append(revised_item)
            else:
                revised_para = self._process_paragraph(item)
                revised_content.append(revised_para)

        # Add missing provisions at appropriate locations
        revised_content = self._insert_missing_provisions(revised_content)

        return revised_content, self.changes

    def _process_table(self, table):
        """Process table, applying changes to cells."""
        revised_table = deepcopy(table)
        for row in revised_table['rows']:
            for cell in row:
                revised_paras = []
                for para in cell['paragraphs']:
                    revised_para = self._process_paragraph(para)
                    revised_paras.append(revised_para)
                cell['paragraphs'] = revised_paras
        return revised_table

    def _process_paragraph(self, para):
        """Process a single paragraph and apply redlines."""
        revised = deepcopy(para)
        text = para.get('text', '').strip()
        para_id = para.get('id', '')
        section_ref = para.get('section_ref', '')
        caption = para.get('caption', '')
        hierarchy = para.get('section_hierarchy', [])

        if not text:
            return revised

        # Apply redlines based on content analysis
        new_text, rationale, change_type = self._analyze_and_redline(
            text, para_id, section_ref, caption, hierarchy
        )

        if new_text != text:
            revised['text'] = new_text
            revised['rationale'] = rationale
            revised['change_type'] = change_type

            # Record the change
            self._record_change(para, new_text, rationale, change_type)

        return revised

    def _analyze_and_redline(self, text, para_id, section_ref, caption, hierarchy):
        """Analyze paragraph and determine appropriate redlines."""

        original = text
        rationale = None
        change_type = None

        # Get current top-level section for context
        top_section = hierarchy[0]['caption'] if hierarchy else None

        # ============================================================
        # SECTION 3: DUE DILIGENCE
        # ============================================================

        if self._in_section(hierarchy, "Due Diligence"):

            # Due Diligence Materials delivery
            if "Within three (3) days after the Effective Date" in text and "Due Diligence Materials" in text:
                text = text.replace(
                    "Within three (3) days after the Effective Date, Seller shall deliver to Purchaser",
                    "Within five (5) business days after the Effective Date, Seller shall deliver to Purchaser (or make available via electronic data room)"
                )
                text = text.replace(
                    "Seller shall cooperate with Purchaser's efforts",
                    "Seller shall use commercially reasonable efforts to cooperate with Purchaser's efforts"
                )
                if "In addition, Seller agrees that" in text:
                    text = text.replace(
                        "Seller will provide updates of such Due Diligence Materials upon Purchaser's reasonable request",
                        "Seller will provide updates of such Due Diligence Materials upon Purchaser's reasonable request to the extent such updates are in Seller's possession or control"
                    )
                rationale = "Extended delivery to 5 business days; added data room option; limited update obligation to materials in Seller's possession."
                change_type = "scope"

            # Service contract termination
            elif "Seller shall terminate in writing, at Seller's sole cost and expense" in text and "Service Contracts" in text:
                text = text.replace(
                    "Seller shall terminate in writing, at Seller's sole cost and expense, and at no cost or liability to Purchaser, all other Service Contracts",
                    "Seller shall use commercially reasonable efforts to terminate in writing all other Service Contracts; provided that Seller shall not be required to pay any termination fee or penalty in excess of Two Thousand Dollars ($2,000) per contract"
                )
                rationale = "Limited to commercially reasonable efforts; capped termination fees at $2,000 per contract."
                change_type = "scope"

        # ============================================================
        # SECTION 7: SELLER'S REPRESENTATIONS AND WARRANTIES
        # ============================================================

        if self._in_section(hierarchy, "Representations") or self._in_section(hierarchy, "Seller's Representations"):

            # Header - add reference to anti-sandbagging and knowledge definition
            if "Seller makes the following representations and warranties" in text and "Effective Date and again as the Closing Date" in text:
                text = text.replace(
                    "as of the Effective Date and again as the Closing Date, each of which is material",
                    "as of the Effective Date and again as the Closing Date (subject to Sections 7.D and 7.E below), each of which is material"
                )
                rationale = "Added references to anti-sandbagging and knowledge definition provisions."
                change_type = "scope"

            # Authority representation - simplify
            elif "full legal right, power and authority to execute and deliver this Agreement" in text and "all of such action having already been taken" in text:
                text = re.sub(
                    r'without need of any further action.*?all of such action having already been taken\.\s*The person or persons executing this Agreement.*?are duly authorized, directed and empowered to do so\.',
                    '',
                    text
                )
                text = text.strip()
                rationale = "Simplified authority representation; removed unnecessary detail about prior approvals."
                change_type = "scope"

            # Title representation - add knowledge qualifier
            elif "No agreement concerning or restricting the sale of the Property is in effect" in text and "Seller's knowledge" not in text:
                text = text.replace(
                    "No agreement concerning or restricting the sale of the Property is in effect",
                    "To Seller's knowledge, no agreement concerning or restricting the sale of the Property is in effect"
                )
                rationale = "Knowledge qualifier for agreements affecting Property."
                change_type = "knowledge_qualifier"

            # Possession representation - add knowledge qualifier
            elif "At Closing, no lease, occupancy agreement, or license" in text and "Seller's knowledge" not in text:
                text = text.replace(
                    "At Closing, no lease, occupancy agreement",
                    "At Closing, to Seller's knowledge, no lease, occupancy agreement"
                )
                rationale = "Knowledge qualifier for possession/occupancy."
                change_type = "knowledge_qualifier"

            # Due Diligence Materials accuracy - major revision
            elif "Due Diligence Materials delivered from Seller to Purchaser are and will be true, correct, and complete" in text:
                # Remove material adverse change language
                text = re.sub(
                    r'Since the date of the last financial statement.*?operations of the Property\.\s*',
                    '',
                    text
                )
                # Remove "present accurately the results of the operations"
                text = re.sub(
                    r'and present accurately the results of the operations of the Property for the periods indicated',
                    '',
                    text
                )
                # Add knowledge qualifier
                text = text.replace(
                    "The Due Diligence Materials delivered from Seller to Purchaser are and will be true, correct, and complete in all material respects",
                    "To Seller's knowledge, the Due Diligence Materials delivered from Seller to Purchaser are true, correct, and complete in all material respects"
                )
                # Add knowledge qualifiers throughout
                text = text.replace(
                    "there are no parties in possession",
                    "to Seller's knowledge, there are no parties in possession"
                )
                text = text.replace(
                    "there are no agreements, written or oral",
                    "to Seller's knowledge, there are no agreements, written or oral"
                )
                text = text.replace(
                    "Except as shown on the Rent Roll, there are no options",
                    "Except as shown on the Rent Roll, to Seller's knowledge there are no options"
                )
                text = text.replace(
                    "None of the Leases provide tenants",
                    "To Seller's knowledge, none of the Leases provide tenants"
                )
                rationale = "Removed MAE language and audit-level accuracy rep; added knowledge qualifiers throughout."
                change_type = "knowledge_qualifier"

            # Mechanics liens - add knowledge qualifier and ordinary course carve-out
            elif "within the last nine (9) months" in text and "no labor, service or materials" in text:
                if "To Seller's knowledge" not in text and "to Seller's knowledge" not in text:
                    text = "To Seller's knowledge, " + text[0].lower() + text[1:]
                text = text.replace(
                    "to improve the Land, or to rehabilitate, repair, refurbish, or remodel the building(s) or improvements situated on the Property;",
                    "to improve the Land, or to rehabilitate, repair, refurbish, or remodel the building(s) or improvements situated on the Property, except for routine maintenance in the ordinary course of business;"
                )
                rationale = "Knowledge qualifier; ordinary course carve-out for routine maintenance."
                change_type = "knowledge_qualifier"

            # Brokerage/lease reps - add knowledge qualifiers
            elif "No brokerage commission or similar fee is due or unpaid" in text:
                if "To Seller's knowledge" not in text:
                    text = "To Seller's knowledge, " + text[0].lower() + text[1:]
                text = text.replace(
                    "Seller is in full compliance with all of the landlord's obligations",
                    "To Seller's knowledge, Seller is in compliance in all material respects with the landlord's material obligations"
                )
                text = text.replace(
                    "Each rental concession, rental abatement or other benefit granted to tenants under the Leases will have been fully utilized prior to Closing.",
                    "To Seller's knowledge, each material rental concession or abatement has been disclosed to Purchaser."
                )
                rationale = "Knowledge qualifiers; changed 'full compliance' to 'material compliance'; simplified concession rep."
                change_type = "knowledge_qualifier"

            # Taxes - add knowledge qualifier
            elif "There are no unpaid and delinquent taxes" in text:
                if "To Seller's knowledge" not in text:
                    text = text.replace(
                        "There are no unpaid and delinquent taxes",
                        "To Seller's knowledge, there are no unpaid and delinquent taxes"
                    )
                text = text.replace(
                    "Seller has not received any notice, and has no knowledge,",
                    "Seller has not received any written notice"
                )
                rationale = "Knowledge qualifier; changed to 'written notice' standard."
                change_type = "knowledge_qualifier"

            # Condemnation and zoning
            elif "Seller has not received any notice from any governmental agency" in text and "condemning or taking" in text:
                text = text.replace(
                    "Seller has not received any notice",
                    "Seller has not received any written notice"
                )
                if "the Property complies with existing zoning ordinances" in text:
                    text = text.replace(
                        "the Property complies with existing zoning ordinances",
                        "the current use of the Property complies in all material respects with existing zoning ordinances"
                    )
                text = text.replace(
                    "Seller has been issued and holds all certificates of occupancy and other permits necessary",
                    "To Seller's knowledge, Seller has been issued and holds all material certificates of occupancy and other material permits necessary"
                )
                rationale = "Written notice standard; limited zoning rep to current use and material compliance; knowledge qualifier for permits."
                change_type = "knowledge_qualifier"

            # Litigation
            elif "Seller is not a party or otherwise subject to any commitment, obligation" in text and "litigation" in text:
                if "To Seller's knowledge" not in text:
                    text = "To Seller's knowledge, " + text[0].lower() + text[1:]
                rationale = "Knowledge qualifier for litigation/commitments."
                change_type = "knowledge_qualifier"

            # Encumbrances
            elif "No present default or breach exists under any mortgage" in text:
                if "To Seller's knowledge" not in text:
                    text = "To Seller's knowledge, " + text[0].lower() + text[1:]
                text = text.replace("No present default", "no present material default")
                rationale = "Knowledge qualifier; added materiality."
                change_type = "knowledge_qualifier"

            # OFAC/Sanctions - add knowledge qualifier
            elif "OFAC" in text or "Office of Foreign Assets Control" in text or "Specially Designated National" in text:
                if "To Seller's knowledge" not in text and "to Seller's knowledge" not in text:
                    text = re.sub(
                        r'^(Seller (?:represents|warrants|is not))',
                        r'To Seller\'s knowledge, \1',
                        text,
                        flags=re.IGNORECASE
                    )
                rationale = "Knowledge qualifier for OFAC/sanctions representations."
                change_type = "knowledge_qualifier"

            # Insurance representation - add knowledge qualifier
            elif "insurance" in text.lower() and ("Seller represents" in text or "Seller warrants" in text or "policies are in full force" in text):
                if "To Seller's knowledge" not in text:
                    text = text.replace(
                        "policies are in full force and effect",
                        "to Seller's knowledge, policies are in full force and effect"
                    )
                rationale = "Knowledge qualifier for insurance status."
                change_type = "knowledge_qualifier"

            # Environmental - add knowledge qualifier and limit scope
            elif "environmental" in text.lower() and ("hazardous" in text.lower() or "contamination" in text.lower() or "pollution" in text.lower()):
                if "To Seller's knowledge" not in text and "to Seller's knowledge" not in text:
                    text = "To Seller's knowledge, " + text[0].lower() + text[1:]
                text = text.replace(
                    "no Hazardous Materials",
                    "no Hazardous Materials in violation of applicable Environmental Laws"
                )
                text = text.replace(
                    "has not been used for",
                    "to Seller's knowledge, has not been used for"
                )
                rationale = "Knowledge qualifiers for environmental; limited to violations of law."
                change_type = "knowledge_qualifier"

            # Compliance with laws - add materiality and knowledge
            elif "compliance with" in text.lower() and ("all applicable laws" in text.lower() or "all laws" in text.lower()):
                text = text.replace(
                    "in compliance with all applicable laws",
                    "in material compliance with all applicable laws"
                )
                text = text.replace(
                    "in compliance with all laws",
                    "in material compliance with all applicable laws"
                )
                if "To Seller's knowledge" not in text and "represents" in text:
                    text = re.sub(
                        r'(Seller represents.*?that the Property is)',
                        r'To Seller\'s knowledge, \1',
                        text
                    )
                rationale = "Added materiality and knowledge qualifier for legal compliance."
                change_type = "knowledge_qualifier"

            # Tenant estoppels - make best efforts, not absolute
            elif "estoppel" in text.lower() and "Seller shall obtain" in text:
                text = text.replace(
                    "Seller shall obtain",
                    "Seller shall use commercially reasonable efforts to obtain"
                )
                text = text.replace(
                    "Seller's failure to deliver",
                    "Seller's failure to deliver despite such commercially reasonable efforts"
                )
                rationale = "Changed estoppel delivery from absolute obligation to commercially reasonable efforts."
                change_type = "scope"

            # SNDAs - make best efforts, not absolute
            elif "SNDA" in text or "subordination" in text.lower() and "Seller shall" in text:
                if "commercially reasonable efforts" not in text:
                    text = text.replace(
                        "Seller shall deliver",
                        "Seller shall use commercially reasonable efforts to deliver"
                    )
                    text = text.replace(
                        "Seller shall obtain",
                        "Seller shall use commercially reasonable efforts to obtain"
                    )
                rationale = "Changed SNDA delivery from absolute obligation to commercially reasonable efforts."
                change_type = "scope"

            # Representation disclaimers and "except as" carve-outs
            elif "except as expressly set forth" in text.lower() and "no other representations" in text.lower():
                # This is good language for seller, don't change
                pass

            # Catch-all: Any remaining unqualified representation
            elif re.search(r'Seller (represents|warrants) that', text) and "To Seller's knowledge" not in text and "to Seller's knowledge" not in text:
                # Check if this is about something Seller should know for certain
                certain_topics = ["duly organized", "validly existing", "good standing", "authority", "power", "execute", "deliver", "binding", "enforceable"]
                if not any(topic in text.lower() for topic in certain_topics):
                    text = re.sub(
                        r'(Seller (?:represents|warrants) that)',
                        r'To Seller\'s knowledge, \1',
                        text,
                        count=1
                    )
                    rationale = "Added knowledge qualifier to unqualified representation."
                    change_type = "knowledge_qualifier"

            # Truth of representations - add materiality and references
            elif "Truth of Representations" in text and "true and correct as of the Effective Date" in text:
                text = text.replace(
                    "true and correct as of the Effective Date and will be true and correct as of the Closing Date",
                    "true and correct in all material respects as of the Effective Date and will be true and correct in all material respects as of the Closing Date, subject to any updates disclosed pursuant to Section 7.C"
                )
                rationale = "Added materiality qualifier; added disclosure update carve-out."
                change_type = "materiality"

            # Update responsibility - limit remedies
            elif "Responsibility to Update Information" in text or ("Seller will immediately disclose" in text and "material adverse change" in text):
                if "Purchaser shall have all of its remedies" in text:
                    text = text.replace(
                        "Purchaser shall have all of its remedies relating to a Seller breach or default as set forth in Section 14 below",
                        "such disclosure shall not constitute a breach of this Agreement and Purchaser's sole remedy shall be to terminate this Agreement prior to Closing and receive a return of the Deposit"
                    )
                text = text.replace("Seller will immediately disclose", "Seller will promptly disclose")
                text = text.replace("of which Seller has knowledge", "of which Seller has actual knowledge")
                rationale = "Changed 'immediately' to 'promptly'; limited to actual knowledge; disclosure cures breach rather than triggering remedies."
                change_type = "scope"

            # Survival - reduce and add cap
            elif "Survival" in text and "shall survive Closing for a period of" in text:
                text = re.sub(
                    r'shall survive Closing for a period of one \(1\) year',
                    'shall survive Closing for a period of nine (9) months (the "Survival Period")',
                    text
                )
                text = text.rstrip('.')
                text += ". Notwithstanding anything to the contrary in this Agreement, Seller's aggregate liability for breaches of representations and warranties shall not exceed Three Hundred Thousand Dollars ($300,000.00)."
                rationale = "Reduced survival from 1 year to 9 months; added $300,000 liability cap."
                change_type = "cap"

        # ============================================================
        # SECTION 14: DEFAULT REMEDIES
        # ============================================================

        if self._in_section(hierarchy, "Default") or self._in_section(hierarchy, "Remedies"):

            # Purchaser's Pre-Closing Remedies
            if "Purchaser's Pre-Closing Remedies" in text or ("In the event Seller breaches" in text and "specific performance" in text and "terminate this Agreement" in text):
                text = text.replace(
                    "In the event Seller breaches any warranty or representation",
                    "In the event Seller materially breaches any warranty or representation"
                )
                text = text.replace(
                    "fails to comply with or perform any of the covenants",
                    "fails to comply with or perform any of the material covenants"
                )
                if "in Purchaser's sole discretion, shall be entitled to" in text:
                    text = text.replace(
                        "in Purchaser's sole discretion, shall be entitled to",
                        "as Purchaser's sole and exclusive remedy, shall be entitled to"
                    )
                text = text.replace(
                    "up to a maximum of $100,000",
                    "up to a maximum of Fifty Thousand Dollars ($50,000)"
                )
                text = re.sub(
                    r'receive from Seller a reimbursement for all of Purchaser\'s out of pocket costs',
                    'receive from Seller a reimbursement for Purchaser\'s reasonable, documented, third-party out-of-pocket costs',
                    text
                )
                rationale = "Added materiality threshold; made sole and exclusive remedy; reduced reimbursement cap to $50,000; limited to documented third-party costs."
                change_type = "scope"

            # Purchaser's Post-Closing Remedies
            elif "Purchaser's Post-Closing Remedies" in text or ("Seller's default or breach" in text and "survives Closing" in text):
                text = text.replace(
                    "In the event of Seller's default or breach of any warranty, representation",
                    "In the event of Seller's default or material breach of any warranty, representation"
                )
                if "Purchaser shall be entitled to bring an action for Purchaser's actual damages incurred" in text:
                    text = text.replace(
                        "Purchaser shall be entitled to bring an action for Purchaser's actual damages incurred",
                        "subject to the Survival Period and liability cap set forth in Section 7.E, Purchaser shall be entitled to bring an action for Purchaser's actual damages incurred; provided, however, that Purchaser may not recover for any matter of which Purchaser had knowledge prior to Closing and elected to proceed with Closing"
                    )
                rationale = "Added materiality; referenced survival and cap; added anti-sandbagging."
                change_type = "cap"

            # Seller's Remedies - add specific performance option
            elif "Seller's Remedies" in text or ("Deposit shall become due to Seller as full liquidated damages" in text):
                if "at Seller's election" not in text and "Seller may pursue specific performance" not in text:
                    text = text.replace(
                        "the Deposit shall become due to Seller as full liquidated damages and as Seller's sole and exclusive remedy, whereupon this Agreement shall automatically terminate",
                        "at Seller's election: (i) the Deposit shall become due to Seller as full liquidated damages, whereupon this Agreement shall automatically terminate; or (ii) Seller may pursue specific performance of Purchaser's obligation to close this transaction"
                    )
                rationale = "Added specific performance as alternative Seller remedy."
                change_type = "other"

            # Notice and Cure - extend cure period
            elif "Notice and Cure" in text or ("Prior to the exercise of any of the foregoing remedies" in text and "uncured for a period of" in text):
                text = text.replace(
                    "uncured for a period of five (5) days",
                    "uncured for a period of ten (10) business days"
                )
                if "then the non-defaulting Party shall be entitled to pursue" in text:
                    text = text.replace(
                        "then the non-defaulting Party shall be entitled to pursue the remedies set forth above",
                        "then the non-defaulting Party shall be entitled to pursue the remedies set forth above; provided that if such default is of a nature that cannot reasonably be cured within such ten (10) business day period, the defaulting Party shall have such additional time as is reasonably necessary (not to exceed thirty (30) days) to cure such default so long as it commences such cure within such ten (10) business day period and diligently pursues such cure to completion"
                    )
                rationale = "Extended cure period to 10 business days; added extended cure for defaults requiring more time."
                change_type = "cure_right"

        # ============================================================
        # SECTION 18: RULE 3-14 AUDIT
        # ============================================================

        if "Rule 3-14" in text:
            if "Purchaser shall have the right to terminate this Agreement at any time prior to Closing" in text:
                text = re.sub(
                    r'Notwithstanding anything to the contrary in this Agreement, Purchaser shall have the right to terminate this Agreement at any time prior to Closing by written notice.*?returned to Purchaser and this Agreement.*?shall.*?be null and void\.',
                    'Seller\'s obligations under this Section 18 shall survive Closing for a period of twelve (12) months.',
                    text,
                    flags=re.DOTALL
                )
                rationale = "Removed Purchaser termination right for Rule 3-14 non-compliance; limited survival to 12 months."
                change_type = "scope"
            elif "make available to Purchaser and Purchaser's representatives for inspection" in text:
                text = text.replace(
                    "all of Seller's books and records reasonably requested by Purchaser relating to Seller's operations on the Property",
                    "such of Seller's books and records as are in Seller's possession and are reasonably requested by Purchaser relating to Seller's operations on the Property"
                )
                text = text.replace(
                    "to cause Seller's employees and accountants to cooperate",
                    "to cause Seller's accountants to cooperate"
                )
                text = text.replace(
                    "at Purchaser's expense",
                    "at Purchaser's sole cost and expense"
                )
                rationale = "Limited to records in Seller's possession; removed employee cooperation requirement."
                change_type = "scope"

        # ============================================================
        # SECTION 20: ASSIGNMENT
        # ============================================================

        if "Assignment" in (caption or '') or self._in_section(hierarchy, "Assignment"):
            if "Unrestricted Right to Assign to Subsidiaries" in text or ("at least a ten percent (10%) ownership interest" in text):
                text = text.replace(
                    "at least a ten percent (10%) ownership interest",
                    "at least a fifty percent (50%) ownership interest and which Purchaser controls"
                )
                text = text.replace(
                    "freely and without Seller's consent",
                    "without Seller's consent but upon prior written notice to Seller"
                )
                rationale = "Increased ownership threshold from 10% to 50%; added control requirement; required notice to Seller."
                change_type = "scope"

        # ============================================================
        # INDEMNIFICATION
        # ============================================================

        if "indemnif" in text.lower():
            # Add knowledge qualifier if Seller is indemnifying
            if "Seller shall indemnify" in text or "Seller hereby indemnifies" in text:
                # Add basket
                if "basket" not in text.lower() and "deductible" not in text.lower():
                    if text.rstrip().endswith('.'):
                        text = text.rstrip()[:-1] + "; provided, however, that Seller shall have no liability under this Section until the aggregate amount of all claims exceeds Twenty-Five Thousand Dollars ($25,000), and then only for amounts in excess of such threshold."
                    rationale = "Added indemnity basket/deductible."
                    change_type = "cap"
                # Add cap if none
                if "shall not exceed" not in text and "maximum" not in text.lower() and "cap" not in text.lower():
                    text = text.rstrip()
                    if text.endswith('.'):
                        text = text[:-1]
                    text += "; provided further that Seller's aggregate liability for indemnification claims shall not exceed Three Hundred Thousand Dollars ($300,000)."
                    rationale = (rationale + " " if rationale else "") + "Added indemnity liability cap."
                    change_type = "cap"
                # Exclude consequential damages
                if "consequential" not in text.lower():
                    text = text.rstrip()
                    if text.endswith('.'):
                        text = text[:-1]
                    text += " In no event shall Seller be liable for any consequential, punitive, or speculative damages."
                    rationale = (rationale + " " if rationale else "") + "Excluded consequential damages."
                    change_type = "cap"

        # ============================================================
        # CLOSING CONDITIONS vs COVENANTS
        # ============================================================

        # Look for absolute Seller obligations that could be default traps
        if "Seller shall" in text and rationale is None:
            # Delivery obligations
            if "shall deliver" in text and "at Closing" in text:
                if "commercially reasonable efforts" not in text and "use reasonable efforts" not in text:
                    # Check if this is a standard closing deliverable or something more problematic
                    problematic_items = ["estoppel", "SNDA", "consent", "approval", "certificate", "third party"]
                    if any(item.lower() in text.lower() for item in problematic_items):
                        text = text.replace(
                            "Seller shall deliver",
                            "Seller shall use commercially reasonable efforts to deliver"
                        )
                        rationale = "Changed absolute delivery obligation to commercially reasonable efforts."
                        change_type = "scope"

            # Performance obligations prior to closing
            elif "prior to Closing" in text or "before Closing" in text or "on or before the Closing Date" in text:
                if "shall cause" in text or "shall obtain" in text or "shall procure" in text:
                    if "commercially reasonable efforts" not in text:
                        text = text.replace("shall cause", "shall use commercially reasonable efforts to cause")
                        text = text.replace("shall obtain", "shall use commercially reasonable efforts to obtain")
                        text = text.replace("shall procure", "shall use commercially reasonable efforts to procure")
                        rationale = "Changed absolute pre-closing obligation to commercially reasonable efforts."
                        change_type = "scope"

        # ============================================================
        # PURCHASER'S CONDITIONS PRECEDENT
        # ============================================================

        if "condition" in text.lower() and "precedent" in text.lower() and "Purchaser" in text:
            # Make sure failure doesn't trigger default
            if "default" in text.lower() and "shall not constitute" not in text.lower():
                text = re.sub(
                    r'(failure.*?)(shall constitute|constitutes|is)(.*?default)',
                    r'\1shall NOT constitute\3',
                    text,
                    flags=re.IGNORECASE
                )
                rationale = "Clarified that condition failure is not a default."
                change_type = "scope"

        # ============================================================
        # PRORATIONS AND ADJUSTMENTS
        # ============================================================

        if "proration" in text.lower() or "prorated" in text.lower():
            # Ensure survival limitation
            if "survive" in text.lower() and "one hundred eighty" not in text and "180" not in text:
                text = re.sub(
                    r'shall survive Closing for a period of (?:one \(1\) year|twelve \(12\) months|365 days)',
                    'shall survive Closing for a period of one hundred eighty (180) days',
                    text,
                    flags=re.IGNORECASE
                )
                if "shall survive Closing" in text and "180" not in text:
                    text = text.replace(
                        "shall survive Closing",
                        "shall survive Closing for a period of one hundred eighty (180) days"
                    )
                rationale = "Limited proration survival to 180 days."
                change_type = "survival"

        # ============================================================
        # BROKERS
        # ============================================================

        if "broker" in text.lower() and "commission" in text.lower():
            if "Seller shall indemnify" in text or "Seller hereby indemnifies" in text:
                if "arising out of Seller's" not in text and "through Seller" not in text:
                    text = text.replace(
                        "Seller shall indemnify",
                        "Seller shall indemnify Purchaser solely with respect to claims arising out of Seller's actions or agreements with brokers, and Seller"
                    )
                    rationale = "Limited broker indemnity to claims arising from Seller's actions."
                    change_type = "scope"

        # ============================================================
        # CASUALTY AND CONDEMNATION
        # ============================================================

        if ("casualty" in text.lower() or "condemnation" in text.lower() or "taking" in text.lower()):
            # Make sure there's a materiality threshold for termination
            if "terminate" in text.lower() and "material" not in text.lower():
                if "Purchaser may terminate" in text or "Purchaser shall have the right to terminate" in text:
                    text = text.replace(
                        "Purchaser may terminate",
                        "if the cost to repair exceeds Five Hundred Thousand Dollars ($500,000) or such casualty or condemnation materially impairs access to or use of the Property, Purchaser may terminate"
                    )
                    rationale = "Added materiality threshold for casualty/condemnation termination."
                    change_type = "scope"

        # ============================================================
        # CONFIDENTIALITY
        # ============================================================

        if "confidential" in text.lower():
            # Add standard carve-outs if not present
            if "shall not disclose" in text and "except" not in text:
                text = text.replace(
                    "shall not disclose",
                    "shall not disclose (except to its attorneys, accountants, lenders, investors, and other advisors who agree to maintain confidentiality, and except as required by law or court order)"
                )
                rationale = "Added standard confidentiality carve-outs."
                change_type = "scope"

        return text, rationale, change_type

    def _in_section(self, hierarchy, section_name):
        """Check if current hierarchy includes a section with given name."""
        for item in hierarchy:
            caption = item.get('caption', '') or ''
            if section_name.lower() in caption.lower():
                return True
        return False

    def _record_change(self, para, new_text, rationale, change_type):
        """Record a change for the manifest."""
        self.changes.append({
            'para_id': para.get('id'),
            'section_ref': para.get('section_ref'),
            'section_hierarchy': para.get('section_hierarchy', []),
            'caption': para.get('caption'),
            'rationale': rationale,
            'change_type': change_type
        })

    def _insert_missing_provisions(self, content):
        """Insert provisions from preferred form that are missing from target."""

        # Define all provisions to insert
        provisions_to_insert = [
            {
                'section_letter': 'D',
                'title': "Seller's Knowledge",
                'content': PREFERRED_LANGUAGE['seller_knowledge_definition'],
                'rationale': 'Import from preferred form: defines knowledge as actual knowledge of designated representative.',
                'insert_after_section': 'Representations',  # Insert after reps section
                'look_for': 'Survival'  # Insert before survival if found
            },
            {
                'section_letter': 'E',
                'title': 'Anti-Sandbagging',
                'content': PREFERRED_LANGUAGE['anti_sandbagging'],
                'rationale': 'Import from preferred form: prevents Purchaser from claiming breach if knew of issue before Closing.',
                'insert_after_section': 'Representations',
                'look_for': 'Survival'
            },
            {
                'section_letter': 'F',
                'title': 'As-Is Acknowledgment',
                'content': PREFERRED_LANGUAGE['as_is_clause'],
                'rationale': 'Import from preferred form: Purchaser acknowledges property sold as-is.',
                'insert_after_section': 'Representations',
                'look_for': 'Survival'
            },
            {
                'section_letter': 'G',
                'title': "Purchaser's Release",
                'content': PREFERRED_LANGUAGE['purchaser_release'],
                'rationale': 'Import from preferred form: Purchaser releases Seller from property condition claims.',
                'insert_after_section': 'Representations',
                'look_for': 'Survival'
            },
            {
                'section_letter': 'H',
                'title': 'No Recourse',
                'content': PREFERRED_LANGUAGE['no_recourse'],
                'rationale': 'Import from preferred form: limits recourse to Seller entity only, no personal liability.',
                'insert_after_section': 'Representations',
                'look_for': 'Survival'
            },
            {
                'section_letter': 'I',
                'title': 'Limitation on Damages',
                'content': PREFERRED_LANGUAGE['no_consequential'],
                'rationale': 'Import from preferred form: excludes consequential and punitive damages.',
                'insert_after_section': 'Default',
                'look_for': None
            },
        ]

        # Find insertion point - look for Survival section in Seller's Representations
        insert_index = None
        reps_section_num = None

        for i, item in enumerate(content):
            if item.get('type') != 'paragraph':
                continue
            hierarchy = item.get('section_hierarchy', [])
            caption = item.get('caption', '') or ''
            text = item.get('text', '') or ''

            # Find the representations section number
            if hierarchy:
                top_caption = (hierarchy[0].get('caption') or '').lower()
                if 'seller' in top_caption and 'representation' in top_caption:
                    reps_section_num = hierarchy[0].get('number', '')
                    # Look for Survival subsection
                    if 'survival' in caption.lower() or 'survival' in text.lower():
                        insert_index = i
                        break

        # If we found an insertion point, insert the new provisions
        if insert_index is not None:
            new_paragraphs = []

            for prov in provisions_to_insert:
                # Check if this concept already exists
                concept_exists = False
                search_terms = {
                    "Seller's Knowledge": ["designated seller representative", "actual knowledge", "seller's knowledge"],
                    "Anti-Sandbagging": ["sandbagging", "knew of", "knowledge of such breach", "deemed to have waived"],
                    "As-Is Acknowledgment": ["as-is", "where-is", "as is", "where is", "expressly disclaims"],
                    "Purchaser's Release": ["releases seller", "waives any claim", "releases and discharges"],
                    "No Recourse": ["no recourse", "look solely to"],
                    "Limitation on Damages": ["consequential", "punitive", "speculative"]
                }

                terms_to_check = search_terms.get(prov['title'], [])
                for item in content:
                    item_text = (item.get('text', '') or '').lower()
                    if any(term in item_text for term in terms_to_check):
                        concept_exists = True
                        break

                if concept_exists:
                    continue  # Skip if concept already exists

                # Create new paragraph
                new_para_id = f"p_NEW_{prov['section_letter']}"
                section_ref = f"{reps_section_num}{prov['section_letter']}" if reps_section_num else prov['section_letter']

                new_para = {
                    'type': 'paragraph',
                    'id': new_para_id,
                    'text': f"{prov['section_letter']}. {prov['title']}. {prov['content']}",
                    'section_ref': section_ref,
                    'caption': prov['title'],
                    'section_hierarchy': [
                        {'level': 0, 'number': reps_section_num or '9.', 'caption': "Seller's Representations and Warranties"},
                        {'level': 1, 'number': f"{prov['section_letter']}.", 'caption': prov['title']}
                    ],
                    'is_insertion': True,
                    'rationale': prov['rationale']
                }
                new_paragraphs.append(new_para)

                # Record the change
                self.changes.append({
                    'para_id': new_para_id,
                    'section_ref': section_ref,
                    'section_hierarchy': new_para['section_hierarchy'],
                    'caption': f"{prov['title']} [NEW]",
                    'rationale': prov['rationale'],
                    'change_type': 'insertion',
                    'new_content': prov['content']
                })

            # Insert new paragraphs before the Survival section
            if new_paragraphs:
                content = content[:insert_index] + new_paragraphs + content[insert_index:]

        return content


def generate_manifest(changes, context, output_path):
    """Generate the cascading manifest organized by section."""

    lines = [
        "# Contract Redline Manifest",
        "",
        "## Context",
        f"- **Representation**: {context['representation'].title()}",
        f"- **Aggressiveness**: {context['aggressiveness']}/5",
        f"- **Leverage**: {context['leverage'].title()}",
        "",
        f"**Total Changes**: {len(changes)}",
        "",
        "---",
        "",
        "## Changes",
        ""
    ]

    current_headers = []  # Track current section headers

    for change in changes:
        hierarchy = change.get('section_hierarchy', [])
        section_ref = change.get('section_ref', '')
        caption = change.get('caption', '')
        rationale = change.get('rationale', '')
        change_type = change.get('change_type', '')

        # Determine headers to print
        new_headers = []
        for i, item in enumerate(hierarchy):
            level = item.get('level', 0)
            number = item.get('number', '')
            item_caption = item.get('caption', '')

            header_key = f"{level}:{number}"

            if i < len(current_headers) and current_headers[i] == header_key:
                continue  # Already printed this header
            else:
                # New header at this level
                new_headers.append((level, number, item_caption))
                # Reset lower levels
                current_headers = current_headers[:i]
                current_headers.append(header_key)

        # Print new headers
        for level, number, hdr_caption in new_headers:
            if level == 0:
                lines.append(f"### {number} {hdr_caption}")
                lines.append("")
            elif level == 1:
                lines.append(f"#### {number} {hdr_caption}")
                lines.append("")

        # Print the change
        if change.get('change_type') == 'insertion':
            lines.append(f"**[INSERT NEW SECTION]** — {rationale}")
        else:
            # Get local numbering (last item in hierarchy or section_ref)
            local_num = ""
            if hierarchy and len(hierarchy) > 1:
                local_num = hierarchy[-1].get('number', '')
            elif section_ref:
                # Extract just the last part
                local_num = section_ref

            if local_num and caption:
                lines.append(f"**{local_num}** *{caption[:40]}{'...' if len(caption or '') > 40 else ''}* — {rationale}")
            elif caption:
                lines.append(f"*{caption[:40]}{'...' if len(caption or '') > 40 else ''}* — {rationale}")
            else:
                lines.append(f"— {rationale}")

        lines.append("")

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    output_dir = Path('ASB_PSA_redline_full')

    # Load parsed documents
    target = load_json(output_dir / 'target_parsed.json')
    preferred = load_json(output_dir / 'preferred_parsed.json')

    # Context
    context = {
        'representation': 'seller',
        'aggressiveness': 4,
        'leverage': 'equal'
    }

    print("Running comprehensive redline...")

    # Run redliner
    redliner = ComprehensiveRedliner(target, preferred, context)
    revised_content, changes = redliner.run()

    # Create revised document
    revised_doc = {
        'source_file': target['source_file'],
        'revision_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'context': context,
        'content': revised_content,
        'defined_terms': target.get('defined_terms', []),
        'sections': target.get('sections', []),
        'exhibits': target.get('exhibits', [])
    }

    # Save revised JSON
    save_json(revised_doc, output_dir / 'revised.json')

    # Generate manifest
    generate_manifest(changes, context, output_dir / 'manifest.md')

    print(f"\nRedline complete!")
    print(f"Total changes: {len(changes)}")
    print(f"\nOutput files:")
    print(f"  - {output_dir / 'revised.json'}")
    print(f"  - {output_dir / 'manifest.md'}")

    # Rebuild docx
    print("\nRebuilding Word document...")
    import subprocess
    result = subprocess.run([
        'python', 'scripts/rebuild_docx.py',
        'ASB - Jersey City SS PSA (108522403v2) (1).docx',
        str(output_dir / 'revised.json'),
        str(output_dir / 'revised.docx')
    ], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr)


if __name__ == "__main__":
    main()
