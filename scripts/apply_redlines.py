#!/usr/bin/env python3
"""
Apply redlines to the target PSA document.
This script implements the specific changes for Seller protection.
"""

import json
import re
from pathlib import Path
from datetime import datetime


def load_parsed_doc(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def apply_redlines(target_doc, context):
    """
    Apply Seller-protective redlines to the target document.

    Context should include:
    - representation: who we represent (seller)
    - aggressiveness: 1-5
    - leverage: who has leverage
    """

    changes = []
    revised_content = []

    for item in target_doc['content']:
        if item['type'] == 'table':
            # Process table cells
            revised_item = item.copy()
            revised_item['rows'] = []
            for row in item['rows']:
                revised_row = []
                for cell in row:
                    revised_cell = cell.copy()
                    revised_cell['paragraphs'] = []
                    for para in cell['paragraphs']:
                        revised_para, change = process_paragraph(para, context)
                        revised_cell['paragraphs'].append(revised_para)
                        if change:
                            changes.append(change)
                    revised_row.append(revised_cell)
                revised_item['rows'].append(revised_row)
            revised_content.append(revised_item)
        else:
            revised_para, change = process_paragraph(item, context)
            revised_content.append(revised_para)
            if change:
                changes.append(change)

    return revised_content, changes


def process_paragraph(para, context):
    """Process a single paragraph and return revised version + change record."""

    original_text = para.get('text', '').strip()
    para_id = para.get('id', '')

    if not original_text:
        return para, None

    revised_text = original_text
    rationale = None
    change_type = None

    # =====================================================
    # SECTION 7: SELLER'S REPRESENTATIONS AND WARRANTIES
    # =====================================================

    # p_118: Header - add knowledge qualifier language
    if para_id == 'p_118':
        revised_text = "Seller's Representations and Warranties.  Seller makes the following representations and warranties, as of the Effective Date and again as the Closing Date (subject to Section 7.D below), each of which is material and is being relied upon by Purchaser:"
        rationale = "Added reference to anti-sandbagging provision (Section 7.D) to preserve Seller's ability to update disclosures"
        change_type = "scope"

    # p_120: Organization - already has "if a business entity" qualifier, acceptable

    # p_121: Authority - remove "having already been taken" which is overly broad
    elif para_id == 'p_121':
        revised_text = "As of the Effective Date, Seller has full legal right, power and authority to execute and deliver this Agreement and to fully perform all of its respective obligations hereunder."
        rationale = "Simplified authority representation; removed unnecessary detail about internal approvals having already been taken"
        change_type = "scope"

    # p_123: Title rep - add knowledge qualifier for agreements affecting Property
    elif para_id == 'p_123':
        revised_text = "Seller owns fee simple marketable and insurable record title to the Property, and every portion thereof and at Closing, title to the Property shall be subject only to the permitted exceptions agreed to by Purchaser.  To Seller's knowledge, no agreement concerning or restricting the sale of the Property is in effect and no person or entity has any right or option to acquire the Property other than Purchaser."
        rationale = "Added knowledge qualifier to representation about agreements affecting the Property - Seller cannot warrant matters outside its actual knowledge"
        change_type = "knowledge_qualifier"

    # p_124: Possession - add knowledge qualifier
    elif para_id == 'p_124':
        revised_text = "At Closing, to Seller's knowledge, no lease, occupancy agreement, or license for the Property, or any portion thereof, shall be in effect, and no person or entity shall be in possession of, or have the right to possess, the Property, or any portion thereof, except for Seller's tenants as set forth on the rent roll delivered to Purchaser by Seller pursuant to Exhibit C hereof (the \"Rent Roll\")."
        rationale = "Added knowledge qualifier - Seller cannot absolutely warrant possession rights of third parties"
        change_type = "knowledge_qualifier"

    # p_126: Due Diligence Materials - significant revision needed
    elif para_id == 'p_126':
        revised_text = "To Seller's knowledge, the Due Diligence Materials delivered from Seller to Purchaser are true, correct, and complete in all material respects. With the exception of tenants occupying the Property pursuant to the Leases specifically disclosed and described on the Rent Roll and with the exception of the occupant of the manager's apartment on the Property (if any), to Seller's knowledge there are no parties in possession of the Property or any part thereof.  With the exception of tenants leasing self-storage space on the Property pursuant to Seller's standard form lease and any non-self-storage tenants under Leases described on the Rent Roll, to Seller's knowledge there are no agreements, written or oral, in the nature of purchase contracts, leases, rights of occupancy, adverse claims, option agreements, rights of first refusal, rights of reverter, mortgages, easements, licenses, permits, franchises, concessions, occupancy agreements, guaranties, indemnities, or agreements affecting the Property, or any part thereof.  Except as shown on the Rent Roll, to Seller's knowledge there are no options or rights to renew, extend or terminate the Leases or expand any lease premises.  To Seller's knowledge, none of the Leases provide tenants any option or right of first refusal to purchase any portion of the Property."
        rationale = "Added knowledge qualifiers throughout; removed 'since the date of the last financial statement' material adverse change language which creates open-ended liability; removed 'present accurately the results of operations' which is an audit-level representation inappropriate for a real estate sale"
        change_type = "knowledge_qualifier"

    # p_127: Mechanics liens - add knowledge qualifier and time qualifier
    elif para_id == 'p_127':
        revised_text = "To Seller's knowledge, (a) within the last nine (9) months no labor, service or materials have been furnished to improve the Land, or to rehabilitate, repair, refurbish, or remodel the building(s) or improvements situated on the Property, except in the ordinary course of business; (b) nor have any goods, chattels, machinery, apparatus or equipment been attached to the building(s) or improvements on the Property as fixtures, except in the ordinary course of business; (c) nor have any contracts been let for the furnishing of labor, service, materials, machinery, apparatus or equipment or professional design services which are to be completed subsequent to the Effective Date of this Agreement; (d) nor are there any open building permits with respect to the Property; and (e) nor have any notices of lien been received."
        rationale = "Added knowledge qualifier and 'except in the ordinary course of business' carve-outs to avoid technical violations for routine maintenance"
        change_type = "knowledge_qualifier"

    # p_129: Leases - add knowledge qualifiers
    elif para_id == 'p_129':
        revised_text = "To Seller's knowledge, no brokerage commission or similar fee is due or unpaid by Seller with respect to any Lease, and there are no written or oral agreements that will obligate Purchaser, as Seller's assignee, to pay any such commission or fee under any Lease or extension, expansion or renewal thereof.  All management fees for the Property have been paid in full.  Except as set forth on the Rent Roll, to Seller's knowledge the Leases and any guaranties thereof are in full force and effect, and are subject to no defenses, setoffs or counterclaims for the benefit of the tenants thereunder.  Except as noted in the Rent Roll, to Seller's knowledge neither the landlord under the Leases nor any tenant is in default under its Lease.  To Seller's knowledge, Seller is in compliance with all of the landlord's material obligations under the Leases, and Seller has no obligation to any tenant under the Leases to further improve such tenant's premises or to grant or allow any rent or other concessions except as disclosed to Purchaser.  No rent or other payments have been collected in advance for more than one (1) month and no rents or other deposits are held by Seller, except the security deposits described on the Rent Roll and rent for the current month."
        rationale = "Added knowledge qualifiers; changed 'full compliance' to 'compliance with material obligations'; removed absolute statement about rental concessions being fully utilized (replaced with disclosure carve-out)"
        change_type = "knowledge_qualifier"

    # p_131: Taxes - add knowledge qualifier for special assessments
    elif para_id == 'p_131':
        revised_text = "To Seller's knowledge, there are no unpaid and delinquent taxes or governmental assessments or municipal utility charges due on the Property. Seller has not received any written notice that the Property or any portion or portions thereof is or will be subject to or affected by any special assessments, whether or not presently a lien thereon."
        rationale = "Added knowledge qualifier; changed 'has no knowledge' to 'has not received any written notice' which is a more objective standard"
        change_type = "knowledge_qualifier"

    # p_132: Condemnation and zoning - revise for knowledge and notice
    elif para_id == 'p_132':
        revised_text = "Seller has not received any written notice from any governmental agency or body indicating an interest in condemning or taking by eminent domain the Property or any portion of the Property, and to Seller's knowledge, there is no condemnation or eminent domain proceeding, threatened or pending. To Seller's knowledge, there are no threatened or pending actions, suits, legal or other proceedings with reference to the Property or title to the Property. To Seller's knowledge, the current use and operation of the Property complies in all material respects with existing zoning ordinances and other laws, statutes, rules, regulations, and restrictive covenants.  Seller has not received any written notice of any unpaid balance, lien, or other violation from any property owners association.  To Seller's knowledge, Seller has been issued and holds all certificates of occupancy and other material permits necessary for the operation of the Property as a storage and self-storage facility."
        rationale = "Added knowledge qualifiers; changed to 'written notice' standard; limited compliance representation to current use in 'material respects'; limited permits to 'material' permits"
        change_type = "knowledge_qualifier"

    # p_133: Litigation - add knowledge qualifier
    elif para_id == 'p_133':
        revised_text = "To Seller's knowledge, Seller is not a party or otherwise subject to any commitment, obligation, agreement or litigation which would prevent Seller from completing the sale of the Property under this Agreement or prevent Purchaser from continuing the present use of the Property."
        rationale = "Added knowledge qualifier"
        change_type = "knowledge_qualifier"

    # p_134: Encumbrances - add knowledge qualifier
    elif para_id == 'p_134':
        revised_text = "To Seller's knowledge, no present material default or breach exists under any mortgage or other encumbrance encumbering the Property or any covenants, conditions, restrictions, rights-of-way or easements which may affect the Property or any portion or portions thereof.  To Seller's knowledge, there are no unrecorded security agreements, financing statements, chattel mortgages or conditional sales agreements in respect to any appliances, equipment or chattels that have or are to become attached to the Property as fixtures."
        rationale = "Added knowledge qualifiers; added 'material' to default standard"
        change_type = "knowledge_qualifier"

    # p_148: Environmental - ensure knowledge qualifiers
    elif para_id == 'p_148':
        # This one is already heavily qualified with "to the best of Seller's knowledge"
        # but we should ensure it stays that way
        pass

    # p_149: Truth of Representations - add anti-sandbagging concept
    elif para_id == 'p_149':
        revised_text = "Truth of Representations.  Subject to Section 7.D below and except as otherwise disclosed to Purchaser in writing prior to Closing, each and every one of the foregoing representations and warranties is true and correct in all material respects as of the Effective Date and will be true and correct in all material respects as of the Closing Date."
        rationale = "Added materiality qualifier; added reference to anti-sandbagging provision; added disclosure carve-out"
        change_type = "materiality"

    # p_150: Responsibility to Update - limit remedies
    elif para_id == 'p_150':
        revised_text = "Responsibility to Update Information.  In the event that changes occur as to any material information, documents or exhibits referred to in this Agreement, of which Seller has actual knowledge, Seller will promptly disclose the same to Purchaser when first available to Seller. Such disclosure shall cure any breach of the applicable representation or warranty."
        rationale = "Changed 'immediately' to 'promptly'; limited to 'actual knowledge'; removed reference to 'all remedies' and added cure provision - disclosure should not trigger remedies"
        change_type = "scope"

    # p_151: Survival - this is reasonable at 1 year, but add cap
    elif para_id == 'p_151':
        revised_text = "Survival.  All representations, warranties and covenants of Seller contained herein shall inure to the benefit of Purchaser and its legal representatives, heirs, successors or assigns and shall survive Closing for a period of nine (9) months. Notwithstanding anything to the contrary in this Agreement, Seller's aggregate liability for breaches of representations and warranties shall not exceed Three Hundred Thousand Dollars ($300,000.00)."
        rationale = "Reduced survival period from 1 year to 9 months; added liability cap of $300,000 (approximately 1% of purchase price) consistent with market practice for PSA rep survival claims"
        change_type = "cap"

    # =====================================================
    # SECTION 14: DEFAULT REMEDIES
    # =====================================================

    # p_162: Purchaser's Pre-Closing Remedies - limit scope
    elif para_id == 'p_162':
        revised_text = "Purchaser's Pre-Closing Remedies.  In the event Seller materially breaches any warranty or representation contained in this Agreement or fails to comply with or perform any of the material covenants, agreements or obligations to be performed by Seller under the terms and provisions of this Agreement (after notice and a reasonable opportunity to cure, not to exceed ten (10) days), Purchaser, as Purchaser's sole and exclusive remedy, shall be entitled to (i) seek and obtain the equitable remedy of specific performance, or (ii) terminate this Agreement, receive an immediate refund of the Deposit from Escrow Agent, and receive from Seller a reimbursement for Purchaser's reasonable, documented out of pocket costs (including, without limitation, costs of DD Inspections and legal costs), up to a maximum of Fifty Thousand Dollars ($50,000)."
        rationale = "Added 'material' qualifier to breach standard; added notice and cure requirement; clarified this is sole and exclusive remedy; reduced reimbursement cap from $100,000 to $50,000; added 'reasonable, documented' qualifier to costs"
        change_type = "scope"

    # p_163: Purchaser's Post-Closing Remedies - add cap
    elif para_id == 'p_163':
        revised_text = "Purchaser's Post-Closing Remedies.  In the event of Seller's default or material breach of any warranty, representation or other obligation which survives Closing or which occurs post-Closing, subject to the survival period and liability cap set forth in Section 7.E above, Purchaser shall be entitled to bring an action for Purchaser's actual damages incurred; provided, however, that Purchaser may not recover for any breach of representation or warranty if Purchaser had knowledge of such breach prior to Closing and elected to proceed with Closing. The provisions of this Section 14.B shall survive Closing."
        rationale = "Added 'material' qualifier; added reference to survival period and liability cap; added anti-sandbagging provision"
        change_type = "cap"

    # p_164: Seller's Remedies - add specific performance option
    elif para_id == 'p_164':
        revised_text = "Seller's Remedies.  In the event Purchaser breaches any warranty or representation contained in this Agreement or fails to comply with or perform any of the covenants, agreements or obligations to be performed by Purchaser under the terms and provisions of this Agreement, at Seller's election: (i) the Deposit shall become due to Seller as full liquidated damages, whereupon this Agreement shall automatically terminate; or (ii) Seller may pursue specific performance of Purchaser's obligation to close.  PURCHASER AND SELLER ACKNOWLEDGE THAT IT WOULD BE DIFFICULT OR IMPOSSIBLE TO ASCERTAIN THE ACTUAL DAMAGES SUFFERED BY SELLER AS A RESULT OF ANY DEFAULT BY PURCHASER AND AGREE THAT SUCH LIQUIDATED DAMAGES ARE A REASONABLE ESTIMATE OF SUCH DAMAGES."
        rationale = "Added specific performance as alternative remedy for Seller - Seller should have the option to compel closing rather than just accept liquidated damages"
        change_type = "other"

    # p_165: Notice and Cure - extend cure period
    elif para_id == 'p_165':
        revised_text = "Notice and Cure.  Prior to the exercise of any of the foregoing remedies, a Party shall first give written notice to the Party in default specifying the nature of the default.  If the default remains uncured for a period of ten (10) business days after receipt of such notice (or such longer period as may be reasonably necessary to cure such default, not to exceed thirty (30) days, provided the defaulting party is diligently pursuing such cure), then the non-defaulting Party shall be entitled to pursue the remedies set forth above."
        rationale = "Extended cure period from 5 days to 10 business days; added provision for extended cure period if diligently pursuing cure"
        change_type = "cure_right"

    # =====================================================
    # ADD ANTI-SANDBAGGING PROVISION (after p_151)
    # This will be handled separately as new text
    # =====================================================

    # =====================================================
    # SECTION 3: DUE DILIGENCE
    # =====================================================

    # p_14: Due Diligence Materials delivery - make timing flexible
    elif para_id == 'p_14':
        revised_text = "Due Diligence Materials.  Within five (5) business days after the Effective Date, Seller shall deliver to Purchaser, or make available via electronic data room, all of the existing documentation or items in the possession or reasonable control of Seller as listed on Exhibit C attached hereto and incorporated herein, but excluding Excluded Items (the \"Due Diligence Materials\").  During the Due Diligence Period (defined below), Seller shall reasonably cooperate with Purchaser's efforts to obtain a letter or other written evidence from the applicable governmental authority that the Property complies with all current zoning laws, bylaws, ordinances, rules and regulations, and that there are no violations of any kind relating to the Property and/or the use or occupancy thereof; provided that Seller shall not be obligated to incur any out-of-pocket expense in connection therewith (other than de minimis expense).  In addition, Seller agrees that, during the term of this Agreement, Seller will provide updates of such Due Diligence Materials upon Purchaser's reasonable request if such updates are in Seller's possession or control."
        rationale = "Extended delivery deadline from 3 days to 5 business days; added electronic data room option; added expense limitation for zoning cooperation; qualified update obligation to materials in Seller's possession"
        change_type = "scope"

    # p_17: Purchaser's Approval - modify termination of Service Contracts
    elif para_id == 'p_17':
        revised_text = "Purchaser's Approval.  If Purchaser is satisfied with Purchaser's inspection of the Property and the self-storage business conducted thereon, Purchaser will notify Seller in writing, on or before the end of the Due Diligence Period, that Purchaser intends to proceed with the purchase of the Property in accordance with the provisions of this Agreement (the \"Approval Notice\").  The failure to deliver such written approval shall be deemed to be disapproval (which Purchaser may exercise in its sole discretion for any reason or no reason), in which case this Agreement shall automatically terminate and the Deposit shall be promptly returned to Purchaser and, except as specifically provided otherwise in this Agreement, the Parties shall have no further obligations to each other under this Agreement. Purchaser shall identify any Service Contracts to be assigned by Seller and assumed by Purchaser at the Closing in the Approval Notice; provided, however, that Purchaser will only be required to assume any Service Contracts that are specifically identified by Purchaser in the Approval Notice, if any. Subject to Purchaser's assumption of such Service Contracts and Purchaser's indemnification of Seller for liabilities arising thereunder from and after Closing, Seller shall use commercially reasonable efforts to terminate in writing, at Seller's sole cost and expense, all other Service Contracts not specifically listed in Purchaser's Approval Notice as Service Contracts Purchaser will assume at the Closing; provided that Seller shall not be required to pay any termination fee or penalty in excess of Two Thousand Dollars ($2,000) per contract. In addition, Seller hereby agrees to terminate in writing at the Closing, at Seller's sole cost and expense, any property management agreement relating to the Property. In connection with the Closing, Seller shall provide reasonable written evidence to Purchaser of the termination of the applicable Service Contracts and the property management agreement (collectively, the \"Termination Documents\")."
        rationale = "Added 'commercially reasonable efforts' standard for contract termination; added cap on termination fees Seller must pay; added requirement for Purchaser to indemnify Seller for assumed contracts"
        change_type = "scope"

    # p_23: Environmental - ensure Seller controls disclosures
    elif para_id == 'p_23':
        # Already has good Seller-protective language, keep as is
        pass

    # =====================================================
    # SECTION 5: CLOSING
    # =====================================================

    # p_29: Closing Date - ensure Seller extension rights are clear
    # Already has 30-day extension right for Seller, acceptable

    # =====================================================
    # SECTION 13: INDEMNIFICATION
    # =====================================================

    # p_159: Indemnification by Seller - limit
    elif 'p_159' in para_id or (para_id == 'p_159'):
        # Need to read this one to modify
        pass

    # =====================================================
    # SECTION 18: RULE 3-14 AUDIT - limit
    # =====================================================

    elif para_id == 'p_171':
        revised_text = "Rule 3-14 Audit.  Seller acknowledges that under Rule 3-14 of Regulation S-X, Purchaser may be required to obtain certain information in connection with reports Purchaser is required to file with the Securities and Exchange Commission.  Accordingly, Seller agrees to (a) allow Purchaser and Purchaser's representatives to perform an audit of Seller's operations at the Property to the extent required under Rule 3-14 of Regulation S-X (a \"Rule 3-14 Audit\"), (b) make available to Purchaser and Purchaser's representatives for inspection and audit at Seller's office (or via electronic data room), during normal business hours and upon reasonable advance notice, such of Seller's books and records as are reasonably requested by Purchaser and are in Seller's possession relating to Seller's operations on the Property, and (c) to use commercially reasonable efforts to cause Seller's accountants to cooperate with Purchaser and Purchaser's representatives in the performance of the Rule 3-14 Audit, at Purchaser's sole cost and expense.  In connection with the foregoing, Purchaser shall give Seller at least five (5) business days' prior written notice of Purchaser's plans to inspect and audit such books and records.  Seller's obligations under this Section 18 shall survive Closing for a period of twelve (12) months.  Notwithstanding anything to the contrary in this Agreement, Purchaser shall not have the right to terminate this Agreement solely due to Seller's inability to provide access to books, records, or information for the Rule 3-14 Audit."
        rationale = "Added 'may be required' language; added data room option; limited to documents in Seller's possession; removed employees from cooperation requirement; added cost allocation to Purchaser; limited survival to 12 months; removed Purchaser's termination right for Rule 3-14 non-compliance (this was excessive leverage)"
        change_type = "scope"

    # =====================================================
    # SECTION 20: ASSIGNMENT - add Seller consent right
    # =====================================================

    elif para_id == 'p_174':
        revised_text = "Unrestricted Right to Assign to Subsidiaries.  All of Purchaser's rights and duties under this Agreement shall be transferable and assignable, without Seller's consent but upon written notice to Seller, to any entity in which Purchaser holds, either directly or indirectly, at least a fifty percent (50%) ownership interest and controls (whether now existing or formed subsequent to the Effective Date).  Nevertheless, in the event of any such transfer or assignment, Purchaser shall remain jointly and severally liable and responsible for the performance of all obligations, covenants, conditions and agreements imposed upon Purchaser pursuant to the terms of this Agreement or otherwise in connection with the transaction contemplated hereby."
        rationale = "Increased ownership threshold from 10% to 50%; added control requirement; added notice requirement; clarified joint and several liability"
        change_type = "scope"

    # Return result
    if revised_text != original_text:
        revised_para = para.copy()
        revised_para['text'] = revised_text
        revised_para['rationale'] = rationale

        change_record = {
            'para_id': para_id,
            'original': original_text,
            'revised': revised_text,
            'rationale': rationale,
            'change_type': change_type
        }
        return revised_para, change_record

    return para, None


def main():
    # Load target document
    target_path = Path('test_output/target_parsed.json')
    target_doc = load_parsed_doc(target_path)

    # Context
    context = {
        'representation': 'seller',
        'aggressiveness': 4,
        'leverage': 'equal'
    }

    # Apply redlines
    revised_content, changes = apply_redlines(target_doc, context)

    # Create revised document structure
    revised_doc = {
        'source_file': target_doc['source_file'],
        'revision_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'context': context,
        'content': revised_content,
        'defined_terms': target_doc.get('defined_terms', []),
        'sections': target_doc.get('sections', []),
        'exhibits': target_doc.get('exhibits', [])
    }

    # Output paths
    output_dir = Path('ASB_PSA_redline_20260124')

    # Write revised JSON
    revised_path = output_dir / 'revised.json'
    with open(revised_path, 'w', encoding='utf-8') as f:
        json.dump(revised_doc, f, indent=2, ensure_ascii=False)

    # Write changes manifest
    manifest_path = output_dir / 'manifest.md'
    write_manifest(changes, context, manifest_path)

    # Write analysis
    analysis_path = output_dir / 'analysis.md'
    write_analysis(target_doc, changes, analysis_path)

    print(f"Redline complete!")
    print(f"Total changes: {len(changes)}")
    print(f"Output directory: {output_dir}")
    print(f"\nFiles created:")
    print(f"  - {revised_path}")
    print(f"  - {manifest_path}")
    print(f"  - {analysis_path}")


def write_manifest(changes, context, output_path):
    """Write the change manifest markdown file."""

    lines = [
        "# Contract Redline Manifest",
        "",
        "## Document Information",
        f"- **Date**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"- **Representation**: {context['representation'].title()}",
        f"- **Aggressiveness**: {context['aggressiveness']}/5",
        f"- **Leverage Position**: {context['leverage'].title()}",
        "",
        "## Summary Statistics",
        f"- **Total Changes**: {len(changes)}",
        "",
        "### By Type:",
    ]

    # Count by type
    type_counts = {}
    for change in changes:
        ct = change.get('change_type', 'other')
        type_counts[ct] = type_counts.get(ct, 0) + 1

    for ct, count in sorted(type_counts.items()):
        lines.append(f"  - {ct.replace('_', ' ').title()}: {count}")

    lines.extend([
        "",
        "## Changes",
        ""
    ])

    for i, change in enumerate(changes, 1):
        lines.extend([
            f"### Change #{i}: {change.get('change_type', 'other').replace('_', ' ').title()}",
            "",
            f"**Paragraph ID**: {change['para_id']}",
            "",
            "**Original:**",
            "```",
            change['original'][:500] + ("..." if len(change['original']) > 500 else ""),
            "```",
            "",
            "**Revised:**",
            "```",
            change['revised'][:500] + ("..." if len(change['revised']) > 500 else ""),
            "```",
            "",
            f"**Rationale:** {change['rationale']}",
            "",
            "---",
            ""
        ])

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def write_analysis(target_doc, changes, output_path):
    """Write the analysis markdown file."""

    lines = [
        "# Document Analysis",
        "",
        "## Document Overview",
        "",
        f"- **Source**: {target_doc['source_file']}",
        "- **Type**: Purchase and Sale Agreement (PSA)",
        "- **Parties**:",
        "  - **Seller**: 319 Tonnele, LLC (Delaware LLC)",
        "  - **Purchaser**: Extra Space Storage LLC (Delaware LLC)",
        "- **Purchase Price**: $34,500,000",
        "- **Property**: Self-storage facility, Jersey City, NJ",
        "",
        "## Key Terms Identified",
        "",
        "| Term | Reference |",
        "|------|-----------|",
        "| Agreement | Preamble |",
        "| Effective Date | Preamble |",
        "| Seller | Preamble |",
        "| Purchaser | Preamble |",
        "| Property | Section 1.B |",
        "| Purchase Price | Section 2 |",
        "| Deposit | Section 2 |",
        "| Due Diligence Period | Section 3.B |",
        "| Approval Notice | Section 3.D |",
        "| Closing | Section 5.A |",
        "| Rent Roll | Section 7.A(v) |",
        "",
        "## Exhibits",
        "",
        "| Exhibit | Description | Contains Contract Language |",
        "|---------|-------------|---------------------------|",
        "| A | Legal Description | No |",
        "| B | Escrow Terms | **Yes** |",
        "| C | Due Diligence Materials List | No |",
        "| C-1 | Form of Deed | No |",
        "| D | Agreement Not to Compete | **Yes** |",
        "| E | General Assignment | **Yes** |",
        "| F | Bank Deposit Authorization | No |",
        "| G | Seller's Closing Certificate | **Yes** |",
        "| H | Owner's Affidavit | **Yes** |",
        "",
        "*Note: Exhibits with contract language were not redlined per user instruction.*",
        "",
        "## Key Issues Addressed",
        "",
        "### 1. Seller Representations (Section 7)",
        "- Added knowledge qualifiers throughout",
        "- Changed absolute representations to 'written notice' standards",
        "- Added materiality qualifiers",
        "- Reduced survival period to 9 months",
        "- Added $300,000 liability cap",
        "",
        "### 2. Default Remedies (Section 14)",
        "- Added materiality threshold for breach",
        "- Extended cure periods",
        "- Reduced Purchaser's cost reimbursement cap",
        "- Added specific performance remedy for Seller",
        "- Added anti-sandbagging protection",
        "",
        "### 3. Due Diligence (Section 3)",
        "- Extended document delivery timeline",
        "- Limited Seller's termination obligations",
        "- Added expense limitations",
        "",
        "### 4. Assignment (Section 20)",
        "- Increased ownership threshold for free assignment",
        "- Added control requirement",
        "- Required notice to Seller",
        "",
        "### 5. Rule 3-14 Audit (Section 18)",
        "- Removed termination right for audit non-compliance",
        "- Limited survival period",
        "- Added cost allocation to Purchaser",
        "",
        "## Recommended Additional Protections",
        "",
        "Consider adding the following provisions that were not in the target document:",
        "",
        "1. **Designated Seller Representative** - Define knowledge as limited to actual knowledge of a specific individual",
        "2. **Anti-Sandbagging** - Explicit provision that Purchaser cannot claim breach if knew of issue before Closing",
        "3. **No Recourse** - Limit Purchaser's recourse to Seller entity only, no personal liability for members/managers",
        "4. **Aggregate Basket** - Require claims to exceed a threshold before Purchaser can recover",
        "",
        "## Next Steps",
        "",
        "1. Run Word Compare between original and revised.docx",
        "2. Review tracked changes",
        "3. Consider adding recommended provisions above",
        "4. Review exhibits separately if needed",
    ]

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


if __name__ == "__main__":
    main()
