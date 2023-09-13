import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getDatas } from '../../services/apiInstance';
import './Home.css';
import { DataItem } from '../../types/DataItem';

export function Home(): JSX.Element {
  const chartRef = useRef<HTMLDivElement>(null);
  const [datas, setDatas] = useState<DataItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getDatas();

        const dataArr: DataItem[] = Object.entries(response.response).map<DataItem>(
          ([date, values]) => ({
            ...(values as DataItem),
            date: new Date(date),
          }),
        );
        setDatas(dataArr);

        const svg = d3
          .select(chartRef.current)
          .append('svg')
          .attr('width', styleInfo.containerWidth)
          .attr('height', styleInfo.containerHeight);
        const xScale = d3
          .scaleTime()
          .domain(d3.extent(dataArr, d => d.date) as [Date, Date])
          .range([styleInfo.xStart, styleInfo.xEnd]);

        const yScaleLeft = d3
          .scaleLinear()
          .domain([0, d3.max(dataArr, d => d.value_bar) as number])
          .range([styleInfo.yStart, styleInfo.yEnd]);

        svg
          .append('g')
          .attr('transform', `translate(${styleInfo.xStart}, 0)`)
          .call(d3.axisLeft(yScaleLeft).ticks(styleInfo.ticks).tickFormat(d3.format('.2f')));

        const yScaleRight = d3
          .scaleLinear()
          .domain([0, d3.max(dataArr, d => d.value_area) as number])
          .range([styleInfo.yStart, styleInfo.yEnd]);

        svg
          .append('g')
          .attr('transform', `translate(${styleInfo.xEnd + 10}, 0)`)
          .call(d3.axisRight(yScaleRight).ticks(styleInfo.ticks).tickFormat(d3.format('.2f')));

        svg
          .append('text')
          .attr('class', 'y-left-label')
          .attr('x', styleInfo.xStart / 2)
          .attr('y', styleInfo.yEnd)
          .style('text-anchor', 'middle')
          .style('font-size', '14px')
          .text('bar');

        svg
          .append('text')
          .attr('class', 'y-right-label')
          .attr('x', styleInfo.containerWidth - styleInfo.xStart / 2)
          .attr('y', styleInfo.yEnd)
          .style('text-anchor', 'middle')
          .style('font-size', '14px')
          .text('area');

        const xAxis = d3.axisBottom(xScale);
        xAxis.ticks(styleInfo.ticks);
        xAxis.tickSize(styleInfo.tickSize);

        const xAxisGroup = svg
          .append('g')
          .attr('class', 'x-axis')
          .attr('transform', `translate(0, ${styleInfo.yStart})`)
          .call(xAxis);

        xAxisGroup.selectAll('.tick text').each(function (d) {
          const tickText = d3.select(this);
          const dateFormat = d3.timeFormat('%Y-%m-%d');
          const timeFormat = d3.timeFormat('%H:%M:%S');
          const formattedDate = dateFormat(d as Date);

          tickText.text('');
          tickText
            .append('tspan')
            .text(timeFormat(d as Date))
            .attr('x', 0)
            .attr('dy', '1.2em');
          tickText.append('tspan').text(formattedDate).attr('x', 0).attr('dy', '1.2em');
        });

        const tooltip = d3
          .select(chartRef.current)
          .append('div')
          .attr('class', 'tooltip')
          .style('opacity', 0);

        const handleClick = (id: string) => {
          toggleSelectedId('individual', id);
        };

        svg
          .selectAll('.bar')
          .data(dataArr)
          .enter()
          .append('rect')
          .attr('class', d => `bar bar-${d.date} bar-${d.id}`)
          .attr('x', d => xScale(d.date))
          .attr('y', d => yScaleLeft(d.value_bar))
          .attr('width', styleInfo.barWidth)
          .attr('height', d => styleInfo.yStart - yScaleLeft(d.value_bar))
          .attr('fill', d => barColorScale(d.id))
          .style('opacity', styleInfo.offOpacity)
          .on('mouseover', (event: MouseEvent, d: DataItem) => {
            tooltip.transition().duration(200).style('opacity', 0.9);
            tooltip
              .html(`ID: ${d.id}<br>Value Area: ${d.value_area}<br>Value Bar: ${d.value_bar}`)
              .style('left', event.pageX + 10 + 'px')
              .style('top', () => {
                const mouseY = event.pageY;
                const tooltipHeight = tooltip.node()?.offsetHeight || 0;
                const maxY = styleInfo.yStart;
                const minY = styleInfo.yEnd;
                const yValue = Math.min(Math.max(mouseY, minY + tooltipHeight), maxY);
                return yValue + 'px';
              });
          })
          .on('mouseout', () => {
            tooltip.transition().duration(500).style('opacity', 0);
          })
          .on('click', (event: MouseEvent, d: DataItem) => {
            handleClick(d.id);
          });

        const uniqueIds = getUniqueIds(dataArr);

        uniqueIds.forEach(uniqueId => {
          const areaPath = d3
            .area<DataItem>()
            .x(d => xScale(d.date))
            .y0(styleInfo.yStart)
            .y1(d => yScaleRight(d.value_area))
            .curve(d3.curveCatmullRom);

          const filteredDataArr = dataArr.filter(v => v.id === uniqueId);
          svg
            .append('path')
            .datum(filteredDataArr)
            .attr('class', d => `area area-${d[0].id}`)
            .attr('d', areaPath)
            .attr('fill', d => areaColorScale(d[0].id))
            .style('opacity', styleInfo.offOpacity);
        });

        svg
          .selectAll('.area')
          .on('mousemove', (event, d) => {
            const mouseX = event.pageX;
            const closestDataPoint = getClosestDataPoint(d as DataItem[], xScale.invert(mouseX));
            if (closestDataPoint) {
              tooltip.transition().style('opacity', 0.9);
              tooltip
                .html(
                  `ID: ${closestDataPoint.id}<br>Value Area: ${closestDataPoint.value_area}<br>Value Bar: ${closestDataPoint.value_bar}`,
                )
                .style('left', mouseX + 10 + 'px')
                .style('top', () => {
                  const mouseY = event.pageY;
                  const tooltipHeight = tooltip.node()?.offsetHeight || 0;
                  const maxY = styleInfo.yStart;
                  const minY = styleInfo.yEnd;
                  const yValue = Math.min(Math.max(mouseY, minY + tooltipHeight), maxY);
                  return yValue + 'px';
                });
            }
          })
          .on('mouseout', () => {
            tooltip.transition().style('opacity', 0);
          })
          .on('click', (event, d) => {
            const dataItemArray = d as DataItem[];
            if (dataItemArray && dataItemArray.length > 0) {
              handleClick(dataItemArray[0].id);
            }
          });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const uniqueIds = getUniqueIds(datas);

  return (
    <div>
      <div>
        {uniqueIds.length === 0 ? (
          <div>loading...</div>
        ) : (
          uniqueIds.map(id => (
            <button key={id} onClick={() => toggleSelectedId('individual', id)}>
              {id}
            </button>
          ))
        )}
        <button
          id="all-button"
          onClick={() => {
            toggleSelectedId('all');
          }}
        >
          ALL
        </button>
      </div>
      <div ref={chartRef}></div>
    </div>
  );
}

const barColorScale = d3.scaleOrdinal(d3.schemeSet3);
const areaColorScale = d3.scaleOrdinal(d3.schemeCategory10);

function getClosestDataPoint(data: DataItem[], xValue: Date): DataItem | null {
  let closest = null;
  let closestDistance = Infinity;

  data.forEach(d => {
    const distance = Math.abs(+xValue - +d.date);

    if (distance < closestDistance) {
      closest = d;
      closestDistance = distance;
    }
  });

  return closest;
}

function checkAllOn(
  areaElement: d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>,
): boolean {
  let isAllOn = true;
  areaElement.each(function () {
    const currentOpacity = d3.select(this).style('opacity');
    if (currentOpacity === '0.1') isAllOn = false;
  });
  return isAllOn;
}

function getUniqueIds(datas: DataItem[]) {
  const uniqueIds = Array.from(new Set(datas.map(d => d.id)));
  return uniqueIds;
}

const styleInfo = {
  containerWidth: 800,
  containerHeight: 400,
  xStart: 60,
  xEnd: 730,
  yStart: 350,
  yEnd: 50,
  ticks: 5,
  tickSize: 10,
  barWidth: 10,
  offOpacity: '0.1',
  onOpacity: '1',
};

const toggleSelectedId = (mode: string, id?: string) => {
  const barElement = mode === 'all' ? d3.selectAll('.bar') : d3.selectAll(`.bar-${id}`);
  const areaElement = mode === 'all' ? d3.selectAll('.area') : d3.selectAll(`.area-${id}`);
  const currentOpacity = barElement.style('opacity');

  if (
    (mode === 'all' && checkAllOn(areaElement)) ||
    (mode === 'individual' && currentOpacity === styleInfo.onOpacity)
  ) {
    barElement.style('opacity', styleInfo.offOpacity);
    areaElement.style('opacity', styleInfo.offOpacity);
  } else {
    barElement.style('opacity', styleInfo.onOpacity);
    areaElement.style('opacity', styleInfo.onOpacity);
    areaElement.raise();
  }
};
