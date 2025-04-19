import Amadeus from "amadeus";

import { Athena, Dict } from "../../core/athena.js";
import { PluginBase } from "../plugin-base.js";

export default class AmadeusPlugin extends PluginBase {
  amadeus!: any;

  async load(athena: Athena) {
    this.amadeus = new Amadeus({
      clientId: this.config.client_id,
      clientSecret: this.config.client_secret,
    });
    athena.registerTool(
      {
        name: "amadeus/flight-offers-search",
        desc: "Return list of Flight Offers based on searching criteria.",
        args: {
          originLocationCode: {
            type: "string",
            desc: "city/airport IATA code from which the traveler will depart, e.g. BOS for Boston\nExample : SYD",
            required: true,
          },
          destinationLocationCode: {
            type: "string",
            desc: "city/airport IATA code to which the traveler is going, e.g. PAR for Paris\nExample : BKK",
            required: true,
          },
          departureDate: {
            type: "string",
            desc: "the date on which the traveler will depart from the origin to go to the destination. Dates are specified in the ISO 8601 YYYY-MM-DD format, e.g. 2017-12-25\nExample : 2023-05-02",
            required: true,
          },
          returnDate: {
            type: "string",
            desc: "the date on which the traveler will depart from the origin to go to the destination. Dates are specified in the ISO 8601 YYYY-MM-DD format, e.g. 2017-12-25\nExample : 2023-05-02",
            required: false,
          },
          adults: {
            type: "number",
            desc: "the number of adult travelers (age 12 or older on date of departure). The total number of seated travelers (adult and children) can not exceed 9.\nDefault value : 1",
            required: true,
          },
          children: {
            type: "number",
            desc: "the number of child travelers (older than age 2 and younger than age 12 on date of departure) who will each have their own separate seat. If specified, this number should be greater than or equal to 0\nThe total number of seated travelers (adult and children) can not exceed 9.",
            required: false,
          },
          infants: {
            type: "number",
            desc: "the number of infant travelers (whose age is less or equal to 2 on date of departure). Infants travel on the lap of an adult traveler, and thus the number of infants must not exceed the number of adults. If specified, this number should be greater than or equal to 0",
            required: false,
          },
          travelClass: {
            type: "string",
            desc: "most of the flight time should be spent in a cabin of this quality or higher. The accepted travel class is economy, premium economy, business or first class. If no travel class is specified, the search considers any travel class\nAvailable values : ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST",
            required: false,
          },
          includedAirlineCodes: {
            type: "string",
            desc: "This option ensures that the system will only consider these airlines. This can not be cumulated with parameter excludedAirlineCodes.\nAirlines are specified as IATA airline codes and are comma-separated, e.g. 6X,7X,8X",
            required: false,
          },
          excludedAirlineCodes: {
            type: "string",
            desc: "This option ensures that the system will ignore these airlines. This can not be cumulated with parameter includedAirlineCodes.\nAirlines are specified as IATA airline codes and are comma-separated, e.g. 6X,7X,8X",
            required: false,
          },
          nonStop: {
            type: "boolean",
            desc: "if set to true, the search will find only flights going from the origin to the destination with no stop in between\nDefault value : false",
            required: false,
          },
          currencyCode: {
            type: "string",
            desc: "the preferred currency for the flight offers. Currency is specified in the ISO 4217 format, e.g. EUR for Euro",
            required: false,
          },
          maxPrice: {
            type: "number",
            desc: "maximum price per traveler. By default, no limit is applied. If specified, the value should be a positive number with no decimals",
            required: false,
          },
          max: {
            type: "number",
            desc: "maximum number of flight offers to return. If specified, the value should be greater than or equal to 1\nDefault value : 250",
            required: false,
          },
        },
        retvals: {
          data: {
            desc: "The flight offers",
            type: "object",
            required: true,
          },
        },
      },
      {
        fn: async (args) => {
          const response = await this.amadeus.shopping.flightOffersSearch.get({
            originLocationCode: args.originLocationCode,
            destinationLocationCode: args.destinationLocationCode,
            departureDate: args.departureDate,
            returnDate: args.returnDate,
            adults: args.adults,
            children: args.children,
            infants: args.infants,
            travelClass: args.travelClass,
            includedAirlineCodes: args.includedAirlineCodes,
            excludedAirlineCodes: args.excludedAirlineCodes,
            nonStop: args.nonStop,
            currencyCode: args.currencyCode,
            maxPrice: args.maxPrice,
            max: args.max,
          });
          return { data: response.data };
        },
      },
    );
  }

  async unload(athena: Athena) {
    athena.deregisterTool("amadeus/flight-offers-search");
  }
}
