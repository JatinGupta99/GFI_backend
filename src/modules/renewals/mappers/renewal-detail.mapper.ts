import { Renewal } from '../renewal.entity';

export interface RenewalDetailDto {
  _id: string;
  lead_status: string;
  general: {
    firstName: string;
    lastName: string;
    email: string;
    cellPhone: string;
    workPhone: string;
    dob: string;
    jobTitle: string;
    ssn: string;
    spouseName: string;
    spouseDob: string;
    businessName: string;
    spouseSsn: string;
    mailingAddress: string;
    residentialAddress: string;
    howLongAtAddress: string;
    presentEmployer: string;
    businessExperienceSummary: string;
    hasCoApplicant: boolean;
    driversLicenseUploaded: boolean;
    property: string;
    suite: string;
    use: string;
    sf: string;
    notes: string;
    applicationSubmitted: boolean;
  };
  business: {
    legalName: string;
    fein: string;
    stateOfIncorporation: string;
    tradeName: string;
    currentBusinessAddress: string;
    proposedBusinessDescription: string;
    businessTelephone: string;
    isRelocating: string;
    howLongInBusiness: string;
    howManyLocations: string;
    typeOfEntity: string;
  };
  financial: {
    annualIncome: string;
    monthlyMortgageRent: string;
    guarantor: string;
    guarantorSsn: string;
    totalAssets: string;
    liquidAssets: string;
    creditScore: string;
    netWorth: string;
    totalLiabilities: string;
    assetsCheckingAcct: string;
    assetsSavingsAcct: string;
    assetsRealEstate: string;
    assetsStocksBonds: string;
    assets: {
      checkingSavings: boolean;
      stocksBonds: boolean;
      retirementAccounts: boolean;
      automobiles: string;
      realEstateResidence: string;
      realEstateInvestment: string;
      otherAssets: string;
    };
    liabilities: {
      creditCardBalances: string;
      taxesPayable: string;
      mortgagesDue: string;
      otherLiabilities: string;
    };
  };
  dealTerms: {
    rounds: any[];
  };
  current_negotiation: {
    rentPerSf: number;
    annInc: number;
    freeMonths: number;
    term: string;
    tiPerSf: number;
    rcd: string;
  };
  budget_negotiation: {
    rentPerSf: number;
    annInc: number;
    freeMonths: number;
    term: string;
    tiPerSf: number;
    rcd: string;
  };
  references: any[];
  accounting: {
    baseRent: number;
    cam: number;
    lateFee: number;
    ins: number;
    tax: number;
    totalDue: number;
    balanceDue: number;
    rentDueDate: string;
    lateAfter: string;
    balance_forward_0131: number;
    feb_cash_received: number;
    annualPMT: {
      janPmt: number;
      febPmt: number;
      marPmt: number;
      aprPmt: number;
      mayPmt: number;
      junPmt: number;
      julPmt: number;
      augPmt: number;
      septPmt: number;
      octPmt: number;
      novPmt: number;
      decPmt: number;
    };
  };
  broker: {
    brokerParticipation: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    contactName: string;
    email: string;
    phone: string;
    commissionStructure: string;
    commissionAmount: number;
  };
  files: any[];
  createdBy: string;
  form_status: string;
  lead_notes: string;
  signatureStatus: string;
  approved_terms: {
    rentPerSf: number;
    annInc: number;
    freeMonths: number;
    term: string;
    tiPerSf: number;
    rcd: string;
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
  id: string;
  fullName: string;
}

export class RenewalDetailMapper {
  static toDetailDto(renewal: any): RenewalDetailDto {
    return {
      _id: renewal._id?.toString() || renewal.id,
      lead_status: renewal.status || '',
      general: {
        firstName: '',
        lastName: '',
        email: '',
        cellPhone: '',
        workPhone: '',
        dob: '',
        jobTitle: '',
        ssn: '',
        spouseName: '',
        spouseDob: '',
        businessName: renewal.tenantName || '',
        spouseSsn: '',
        mailingAddress: '',
        residentialAddress: '',
        howLongAtAddress: '',
        presentEmployer: '',
        businessExperienceSummary: '',
        hasCoApplicant: false,
        driversLicenseUploaded: false,
        property: renewal.propertyName || '',
        suite: renewal.suite || '',
        use: '',
        sf: renewal.sf?.toString() || '0',
        notes: renewal.notes || '',
        applicationSubmitted: false,
      },
      business: {
        legalName: '',
        fein: '',
        stateOfIncorporation: '',
        tradeName: '',
        currentBusinessAddress: '',
        proposedBusinessDescription: '',
        businessTelephone: '',
        isRelocating: '',
        howLongInBusiness: '',
        howManyLocations: '',
        typeOfEntity: '',
      },
      financial: {
        annualIncome: '',
        monthlyMortgageRent: '',
        guarantor: '',
        guarantorSsn: '',
        totalAssets: '',
        liquidAssets: '',
        creditScore: '',
        netWorth: '',
        totalLiabilities: '',
        assetsCheckingAcct: '',
        assetsSavingsAcct: '',
        assetsRealEstate: '',
        assetsStocksBonds: '',
        assets: {
          checkingSavings: false,
          stocksBonds: false,
          retirementAccounts: false,
          automobiles: '',
          realEstateResidence: '',
          realEstateInvestment: '',
          otherAssets: '',
        },
        liabilities: {
          creditCardBalances: '',
          taxesPayable: '',
          mortgagesDue: '',
          otherLiabilities: '',
        },
      },
      dealTerms: {
        rounds: [],
      },
      current_negotiation: {
        rentPerSf: renewal.rentPerSf || 0,
        annInc: renewal.currentMonthRent ? renewal.currentMonthRent * 12 : 0,
        freeMonths: 0,
        term: renewal.optionTerm || '',
        tiPerSf: 0,
        rcd: renewal.rcd || '',
      },
      budget_negotiation: {
        rentPerSf: renewal.budgetRentPerSf || 0,
        annInc: renewal.budgetRent ? renewal.budgetRent * 12 : 0,
        freeMonths: 0,
        term: '',
        tiPerSf: renewal.budgetTI || 0,
        rcd: renewal.budgetLCD || '',
      },
      references: [],
      accounting: {
        baseRent: renewal.currentMonthRent || 0,
        cam: 0,
        lateFee: 0,
        ins: 0,
        tax: 0,
        totalDue: 0,
        balanceDue: 0,
        rentDueDate: '',
        lateAfter: '',
        balance_forward_0131: 0,
        feb_cash_received: 0,
        annualPMT: {
          janPmt: 0,
          febPmt: 0,
          marPmt: 0,
          aprPmt: 0,
          mayPmt: 0,
          junPmt: 0,
          julPmt: 0,
          augPmt: 0,
          septPmt: 0,
          octPmt: 0,
          novPmt: 0,
          decPmt: 0,
        },
      },
      broker: {
        brokerParticipation: '',
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        contactName: '',
        email: '',
        phone: '',
        commissionStructure: '',
        commissionAmount: 0,
      },
      files: [],
      createdBy: '',
      form_status: 'CREATED',
      lead_notes: renewal.notes || '',
      signatureStatus: 'DRAFT',
      approved_terms: {
        rentPerSf: renewal.budgetRentPerSf || 0,
        annInc: renewal.budgetRent ? renewal.budgetRent * 12 : 0,
        freeMonths: 0,
        term: '',
        tiPerSf: renewal.budgetTI || 0,
        rcd: renewal.budgetLCD || '',
      },
      createdAt: renewal.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: renewal.updatedAt?.toISOString() || new Date().toISOString(),
      __v: renewal.__v || 0,
      id: renewal._id?.toString() || renewal.id,
      fullName: renewal.tenantName || '',
    };
  }
}
