import _ from 'lodash';
import assert from 'assert';

export default function TicketService($http, $filter, UserService) {
  var ticketsCache = null;
  var ticketsByRouteId = null;
  return {

    getTickets: function(ignoreCache) {
      if (ticketsCache && !ignoreCache) return Promise.resolve(ticketsCache);
      return UserService.beeline({
        method: 'GET',
        url: '/tickets',
			            }).then((response) => {
  ticketsCache = response.data;
  ticketsByRouteId = _.groupBy(ticketsCache, ticket => ticket.boardStop.trip.routeId);

  return ticketsCache;
			});
    },

    getTicketsByRouteId(rid) {
      return this.getTickets()
      .then(() => {
        return ticketsByRouteId[rid];
      });
    },

    getTicketById: function(id, ignoreCache) {
      assert.equal(typeof id, 'number');
      return this.getTickets(ignoreCache).then(function(tickets) {
        return _.find(tickets, {id: id});
      });
    },

    getCategorizedTickets: function(ignoreCache) {
      return this.getTickets(ignoreCache).then(function(tickets) {
        var now = new Date();
        var lastMidnight = now.setHours(0, 0, 0, 0);
        var nextMidnight = now.setHours(24, 0, 0, 0);
        var categorizedTickets = {};
        categorizedTickets.today = tickets.filter(function(ticket) {
          return ticket.boardStop !== null &&
                 Date.parse(ticket.boardStop.time) >= lastMidnight &&
                 Date.parse(ticket.boardStop.time) < nextMidnight;
        });
        categorizedTickets.afterToday = tickets.filter(function(ticket) {
          return ticket.boardStop !== null &&
                 Date.parse(ticket.boardStop.time) >= nextMidnight;
        });
        return categorizedTickets;
      });
		        }

  };
}
