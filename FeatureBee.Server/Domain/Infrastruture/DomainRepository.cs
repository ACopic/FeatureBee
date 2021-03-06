﻿namespace FeatureBee.Server.Domain.Infrastruture
{
    using System;
    using System.Collections.Generic;
    using System.Threading;

    using NEventStore;

    public class DomainRepository : IDomainRepository
    {
        private readonly IStoreEvents eventStore;

        public DomainRepository(IStoreEvents eventStore)
        {
            this.eventStore = eventStore;
        }

        public IEnumerable<IDomainEvent> GetById(Guid id)
        {
            var list = new List<IDomainEvent>();
            using (var stream = eventStore.OpenStream(id, 0, int.MaxValue))
            {
                var committedEvents = stream.CommittedEvents;
                foreach (var eventMessage in committedEvents)
                {
                    list.Add(eventMessage.Body as IDomainEvent);
                }
            }
            return list;
        }

        public void Save<T>(T aggregateRoot) where T : BaseAggregateRoot
        {
            using (var stream = eventStore.OpenStream(aggregateRoot.Id, 0, int.MaxValue))
            {
                if (stream.StreamRevision != aggregateRoot.Version)
                {
                    throw new ConcurrencyException();
                }

                foreach (var @event in aggregateRoot.GetChanges())
                {
                    var uncommittedEvent = new EventMessage {Body = @event };
                    uncommittedEvent.Headers.Add("UserId", Thread.CurrentPrincipal.Identity.Name);
                    stream.Add(uncommittedEvent);
                    stream.CommitChanges(Guid.NewGuid());
                }
            }
        }
    }
}