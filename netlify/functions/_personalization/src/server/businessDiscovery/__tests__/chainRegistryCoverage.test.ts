import { describe, it, expect } from 'vitest'
import { classifyOwnership } from '../ownershipClassification'

/** Well-known U.S. national/regional chains that must never be returned as "local independents". */
const CHAINS = [
  'Checkers', "Rally's", 'Krystal', 'Whataburger', 'Sonic Drive-In', 'Popeyes', "Zaxby's", 'Cook Out', "Culver's", "Raising Cane's",
  'Bojangles', "Church's Chicken", 'Jack in the Box', 'Del Taco', "Wendy's", "Arby's", "Hardee's", "Carl's Jr.", 'Dairy Queen',
  'Waffle House', 'Panda Express', "Moe's Southwest Grill", 'Qdoba', 'El Pollo Loco', 'In-N-Out Burger', 'Shake Shack', 'Steak n Shake',
  'Buffalo Wild Wings', 'Firehouse Subs', 'Tim Hortons', 'Krispy Kreme', 'Dutch Bros', 'Panera Bread', 'Chick-fil-A', 'Taco Bell',
  'Burger King', 'Starbucks', "Dunkin'", 'Subway', "Domino's", "Papa John's", "Papa Murphy's", 'Little Caesars', 'Pizza Hut',
  "Jimmy John's", "Jersey Mike's", 'Wingstop', 'Smoothie King', 'Tropical Smoothie Cafe', 'Chipotle Mexican Grill', "Chili's", "Applebee's",
  "Denny's", 'IHOP', 'Cracker Barrel', 'Olive Garden', 'Red Lobster', 'Outback Steakhouse', 'Texas Roadhouse', 'Hooters',
  'Walgreens', 'CVS Pharmacy', 'Rite Aid', 'Publix', 'Winn-Dixie', 'Aldi', 'Lidl', 'Food Lion', 'Piggly Wiggly', 'Harris Teeter', 'Meijer', 'H-E-B', 'Wegmans',
  'Dollar General', 'Family Dollar', 'Dollar Tree', 'Big Lots', 'Ollie\'s Bargain Outlet', 'Tractor Supply', 'Harbor Freight', 'Ace Hardware', 'Lowe\'s',
  "O'Reilly Auto Parts", 'Advance Auto Parts', 'AutoZone', 'Pep Boys', 'Firestone', 'Goodyear', 'Discount Tire', 'Take 5 Oil Change', 'Valvoline', 'Jiffy Lube',
  'Planet Fitness', 'Anytime Fitness', 'Orangetheory Fitness', 'Crunch Fitness', "Gold's Gym", 'LA Fitness', 'Snap Fitness', 'Supercuts', 'Great Clips', 'Sport Clips',
  'H&R Block', 'Jackson Hewitt', 'Massage Envy', 'Hand & Stone', 'European Wax Center', 'The UPS Store', 'FedEx Office', 'Aaron\'s', 'Rent-A-Center',
  'Pet Supplies Plus', 'PetSmart', 'Petco', 'Verizon', 'AT&T Store', 'T-Mobile', 'Boost Mobile', 'Metro by T-Mobile', 'Cricket Wireless',
  '7-Eleven', 'Circle K', 'Wawa', 'Sheetz', 'RaceTrac', 'QuikTrip', 'Speedway', 'Cumberland Farms', 'Marathon', 'Citgo',
]

describe('national chain registry coverage', () => {
  it.each(CHAINS)('%s is classified as a national chain', (name) => {
    expect(classifyOwnership({ name } as never).ownership).toBe('national_bigbox')
  })
  it('does not catch genuine independents that merely share a first word', () => {
    for (const n of ['Ross Plumbing', 'Target Roofing & Siding', 'Chase Family Dentistry', 'Shell Beach Cafe', 'Marathon Pet Grooming', 'Speedway Auto Detailing']) {
      expect(classifyOwnership({ name: n } as never).ownership).not.toBe('national_bigbox')
    }
  })
})
